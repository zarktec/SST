import { fetchWithTimeout, networkError } from "../registry/http";
import type { IntegrationDef } from "../registry/types";

const redirectHelpers = (provider: "google" | "microsoft") => (root: string) => [
  {
    label: "URL de redirección (callback) a registrar",
    value: `https://auth.${root}/api/auth/callback/${provider}`,
  },
  ...(provider === "google"
    ? [{ label: "Orígenes JavaScript autorizados", value: `https://auth.${root}` }]
    : []),
];

export const google: IntegrationDef = {
  key: "google",
  label: "Google (login)",
  description: "Inicio de sesión con Google a través del dominio central de autenticación.",
  fields: [
    { name: "clientId", label: "Client ID", kind: "config", required: true },
    { name: "clientSecret", label: "Client Secret", kind: "secret", required: true },
  ],
  helpers: redirectHelpers("google"),
  async test({ config, secrets, fetch: f }) {
    const clientId = String(config.clientId ?? "");
    if (!/\.apps\.googleusercontent\.com$/.test(clientId)) {
      return { ok: false, message: "El Client ID debe terminar en .apps.googleusercontent.com." };
    }
    if (!secrets.clientSecret) return { ok: false, message: "Falta el Client Secret." };
    try {
      const res = await fetchWithTimeout(
        f,
        "https://accounts.google.com/.well-known/openid-configuration",
      );
      return res.ok
        ? {
            ok: true,
            message:
              "Formato válido y Google alcanzable. La validez del secreto se confirma al iniciar sesión por primera vez.",
          }
        : { ok: false, message: `Google respondió ${res.status}.` };
    } catch (e) {
      return networkError(e);
    }
  },
};

export const microsoft: IntegrationDef = {
  key: "microsoft",
  label: "Microsoft Entra ID (login)",
  description: "Inicio de sesión con cuentas Microsoft personales y corporativas.",
  fields: [
    { name: "clientId", label: "Application (client) ID", kind: "config", required: true },
    {
      name: "clientSecret",
      label: "Client Secret",
      kind: "secret",
      required: true,
      hasExpiry: true,
      help: "Los secretos de Microsoft vencen: registra su fecha de expiración para recibir alertas.",
    },
    {
      name: "tenantMode",
      label: "Tenant",
      kind: "config",
      type: "select",
      required: true,
      options: [
        { value: "common", label: "common (cuentas personales y corporativas)" },
        { value: "organizations", label: "organizations (solo corporativas)" },
        { value: "specific", label: "Tenant específico" },
      ],
      defaults: { sandbox: "common", production: "common" },
    },
    { name: "tenantId", label: "Tenant ID (si es específico)", kind: "config" },
  ],
  helpers: redirectHelpers("microsoft"),
  async test({ config, secrets, fetch: f }) {
    const mode = String(config.tenantMode ?? "common");
    const tenant = mode === "specific" ? String(config.tenantId ?? "") : mode;
    const clientId = String(config.clientId ?? "");
    if (!clientId || !secrets.clientSecret)
      return { ok: false, message: "Falta el client ID o el secreto." };
    if (!tenant) return { ok: false, message: "Falta el Tenant ID." };
    try {
      const disc = await fetchWithTimeout(
        f,
        `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/v2.0/.well-known/openid-configuration`,
      );
      if (!disc.ok)
        return { ok: false, message: `Entra ID respondió ${disc.status}: revisa el tenant.` };
      if (mode !== "specific") {
        return {
          ok: true,
          message:
            "Tenant válido. El secreto se confirma al iniciar sesión (solo se puede probar con un tenant específico).",
        };
      }
      // Con tenant específico se puede validar id+secreto con client_credentials.
      const res = await fetchWithTimeout(
        f,
        `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: secrets.clientSecret,
            grant_type: "client_credentials",
            scope: "https://graph.microsoft.com/.default",
          }),
        },
      );
      if (res.ok) return { ok: true, message: "Client ID y secreto válidos." };
      const body = (await res.json().catch(() => ({}))) as { error_description?: string };
      return {
        ok: false,
        message: body.error_description?.split("\r\n")[0] ?? `Entra ID respondió ${res.status}.`,
      };
    } catch (e) {
      return networkError(e);
    }
  },
};
