import { createAuthEndpoint, createAuthMiddleware, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import type { BetterAuthPlugin } from "better-auth";
import * as z from "zod";
import { authHost, normalizeHost, originFor, rootDomain } from "@/core/tenancy/hosts";
import { resolveTenantByHost, resolveTenantBySlug } from "@/core/tenancy/resolve";
import { resolveTenantAccess } from "./access";
import { consumeHandoff, issueHandoff, sanitizeNext } from "./handoff";
import { loginMethodFromPath } from "./login-method";

/**
 * Plugin de Better Auth:
 *  - /handoff/issue   (en auth.): con sesión válida, comprueba el acceso a la empresa y redirige a su
 *                     origen (dominio propio, o dominio raíz con `slug`) con un token de un solo uso.
 *  - /handoff/consume (en ese origen): canjea el token y crea la sesión local.
 *  - hook: registra con qué método se inició sesión (para empresas "solo SSO").
 */
export const handoffPlugin = () =>
  ({
    id: "tenant-handoff",
    endpoints: {
      handoffIssue: createAuthEndpoint(
        "/handoff/issue",
        {
          method: "GET",
          query: z.object({
            host: z.string().max(253),
            /** Empresa por ruta (`/{slug}` del dominio raíz); sin él, la empresa se resuelve por `host` (dominio propio). */
            slug: z.string().max(63).optional(),
            next: z.string().max(500).optional(),
          }),
          use: [sessionMiddleware],
        },
        async (c) => {
          const denied = (reason: string) =>
            c.redirect(`${originFor(authHost())}/login/denied?reason=${reason}`);
          const host = normalizeHost(c.query.host);
          // Solo se redirige al dominio raíz (con una empresa existente) o a dominios propios verificados:
          // evita open redirect.
          const bySlug = c.query.slug && host === normalizeHost(rootDomain());
          const target = bySlug
            ? await resolveTenantBySlug(c.query.slug as string)
            : await resolveTenantByHost(host);
          if (!target) throw denied("unknown_host");
          // Por ruta, el destino siempre queda dentro de la empresa.
          let next = c.query.next;
          if (bySlug) {
            const base = `/${target.slug}`;
            const n = sanitizeNext(next);
            next = n === base || n.startsWith(`${base}/`) ? n : base;
          }
          const { session, user } = c.context.session;
          const loginMethod = (session as { loginMethod?: string | null }).loginMethod ?? null;
          const access = await resolveTenantAccess({
            userId: user.id,
            email: user.email,
            emailVerified: user.emailVerified,
            tenantId: target.tenantId,
            loginMethod,
          });
          if (!access.ok) throw denied(access.reason);
          const token = await issueHandoff({
            userId: user.id,
            tenantId: target.tenantId,
            host,
            loginMethod,
            next,
          });
          throw c.redirect(
            `${originFor(host)}/api/auth/handoff/consume?token=${encodeURIComponent(token)}`,
          );
        },
      ),
      handoffConsume: createAuthEndpoint(
        "/handoff/consume",
        { method: "GET", query: z.object({ token: z.string().max(200) }) },
        async (c) => {
          const host = c.request?.headers.get("host") ?? new URL(c.context.baseURL).host;
          const payload = await consumeHandoff(c.query.token, host);
          if (!payload) throw c.redirect(`${originFor(host)}/login?error=handoff_invalid`);
          const user = await c.context.internalAdapter.findUserById(payload.userId);
          if (!user) throw c.redirect(`${originFor(host)}/login?error=handoff_invalid`);
          const session = await c.context.internalAdapter.createSession(payload.userId, false, {
            activeTenantId: payload.tenantId,
            loginMethod: payload.loginMethod,
          });
          await setSessionCookie(c, { session, user });
          throw c.redirect(`${originFor(host)}${sanitizeNext(payload.next)}`);
        },
      ),
    },
    hooks: {
      after: [
        {
          matcher: () => true,
          handler: createAuthMiddleware(async (ctx) => {
            const created = ctx.context.newSession;
            if (!created) return;
            const method = loginMethodFromPath(ctx.path ?? "");
            if (method)
              await ctx.context.internalAdapter.updateSession(created.session.token, {
                loginMethod: method,
              });
          }),
        },
      ],
    },
  }) satisfies BetterAuthPlugin;
