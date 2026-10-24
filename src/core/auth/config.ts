import "server-only";
import { createHash } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink, twoFactor } from "better-auth/plugins";
import { schema, systemDb } from "@/core/db";
import { sendMail } from "@/core/mail";
import {
  DEFAULT_BRAND,
  renderMagicLink,
  renderResetPassword,
  renderVerifyEmail,
  type Brand,
} from "@/core/mail/templates";
import {
  authHost,
  classifyHost,
  normalizeHost,
  originFor,
  tenantSlugFromPath,
} from "@/core/tenancy/hosts";
import { resolveTenantByHost, resolveTenantBySlug } from "@/core/tenancy/resolve";
import { getRuntimeConfig } from "@/integrations/registry/service";
import { uuidv7 } from "@/lib/uuid";
import { handoffPlugin } from "./handoff-plugin";

type SocialConfig = {
  google?: { clientId: string; clientSecret: string; redirectURI: string };
  microsoft?: { clientId: string; clientSecret: string; tenantId: string; redirectURI: string };
};

/**
 * Proveedores sociales: se leen de la BD (Centro de integraciones) en cada request, no de variables
 * de entorno. Solo existen en el dominio central `auth.`; las empresas entran por el traspaso de sesión.
 */
export async function loadSocialConfig(host: string): Promise<SocialConfig> {
  if (classifyHost(host).kind !== "auth") return {};
  const out: SocialConfig = {};
  const callback = (p: string) => `${originFor(authHost())}/api/auth/callback/${p}`;
  const [g, m] = await Promise.all([getRuntimeConfig("google"), getRuntimeConfig("microsoft")]);
  if (g.enabled && g.config.clientId && g.secrets.clientSecret) {
    out.google = {
      clientId: String(g.config.clientId),
      clientSecret: g.secrets.clientSecret,
      redirectURI: callback("google"),
    };
  }
  if (m.enabled && m.config.clientId && m.secrets.clientSecret) {
    const mode = String(m.config.tenantMode ?? "common");
    out.microsoft = {
      clientId: String(m.config.clientId),
      clientSecret: m.secrets.clientSecret,
      tenantId: mode === "specific" ? String(m.config.tenantId ?? "common") : mode,
      redirectURI: callback("microsoft"),
    };
  }
  return out;
}

/**
 * Marca del correo: la de la empresa del dominio propio o, en el dominio raíz, la de la empresa cuyo
 * `/{slug}` va en el `callbackURL` del enlace (todas comparten origen, así que el host no la identifica).
 */
async function brandFor(host: string, link?: string): Promise<Brand> {
  let t = await resolveTenantByHost(host).catch(() => null);
  if (!t && link) {
    try {
      const cb = new URL(link).searchParams.get("callbackURL") ?? "";
      const slug = tenantSlugFromPath(cb.startsWith("/") ? cb : "");
      t = slug ? await resolveTenantBySlug(slug).catch(() => null) : null;
    } catch {
      /* enlace sin callbackURL válido: marca por defecto */
    }
  }
  return t
    ? { name: t.tradeName, primary: t.brand.primary, logoUrl: t.brand.logoLightUrl }
    : DEFAULT_BRAND;
}

function build(host: string, social: SocialConfig) {
  const origin = originFor(host);
  return betterAuth({
    appName: "SST",
    baseURL: origin,
    secret: process.env.AUTH_SECRET,
    trustedOrigins: [origin],
    database: drizzleAdapter(systemDb(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
        twoFactor: schema.twoFactor,
        rateLimit: schema.rateLimit,
      },
    }),
    advanced: {
      database: { generateId: () => uuidv7() },
      useSecureCookies: origin.startsWith("https"),
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-in/magic-link": { window: 60, max: 3 },
        "/request-password-reset": { window: 300, max: 3 },
        "/two-factor/verify-totp": { window: 60, max: 5 },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      additionalFields: {
        activeTenantId: { type: "string", required: false, input: false },
        impersonatedBy: { type: "string", required: false, input: false },
        impersonationReason: { type: "string", required: false, input: false },
        loginMethod: { type: "string", required: false, input: false },
      },
    },
    user: {
      additionalFields: { locale: { type: "string", required: false, defaultValue: "es-CO" } },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) =>
        sendMail({
          to: user.email,
          subject: "Restablece tu contraseña",
          html: await renderResetPassword(await brandFor(host, url), url),
        }),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) =>
        sendMail({
          to: user.email,
          subject: "Confirma tu correo",
          html: await renderVerifyEmail(await brandFor(host, url), url),
        }),
    },
    // Solo vincula una cuenta social existente si el proveedor confirma el correo como verificado.
    account: {
      accountLinking: { enabled: true, trustedProviders: [], allowDifferentEmails: false },
    },
    socialProviders: social,
    plugins: [
      twoFactor({ issuer: "SST" }),
      magicLink({
        expiresIn: 600,
        sendMagicLink: async ({ email, url }) =>
          sendMail({
            to: email,
            subject: "Tu enlace de acceso",
            html: await renderMagicLink(await brandFor(host, url), url),
          }),
      }),
      handoffPlugin(),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof build>;

const instances = new Map<string, Auth>();
const MAX_INSTANCES = 200;

/** Instancia de Better Auth para un host (baseURL propio) y la configuración de proveedores vigente. */
export async function getAuth(rawHost: string): Promise<Auth> {
  const host = normalizeHost(rawHost);
  const social = await loadSocialConfig(host);
  const fingerprint = createHash("sha1").update(JSON.stringify(social)).digest("hex");
  const key = `${host}|${fingerprint}`;
  let auth = instances.get(key);
  if (!auth) {
    if (instances.size >= MAX_INSTANCES) instances.clear();
    auth = build(host, social);
    instances.set(key, auth);
  }
  return auth;
}

/** Proveedores activos (para mostrar solo los botones de login configurados). */
export async function activeProviders(host: string) {
  const [g, m] = await Promise.all([getRuntimeConfig("google"), getRuntimeConfig("microsoft")]);
  return {
    google: Boolean(g.enabled && g.config.clientId && g.secrets.clientSecret),
    microsoft: Boolean(m.enabled && m.config.clientId && m.secrets.clientSecret),
    host,
  };
}
