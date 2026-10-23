import { fetchWithTimeout, networkError } from "../registry/http";
import type { IntegrationDef } from "../registry/types";

/**
 * AUCO: verificación de identidad (complemento de plan pago: cargo fijo + variable por validación).
 * Docs: https://docs.auco.ai/api/environment
 *  - Stage:      https://dev.auco.ai/v1.5/ext   (sin cobros)
 *  - Producción: https://api.auco.ai/v1.5/ext
 *  - Autenticación: encabezado `Authorization: <llave>`; lectura (GET) con llave pública `puk_…`,
 *    escritura (POST/PUT/DELETE) con llave privada `prk_…`.
 * El flujo de validación (Aucoface/Veriface) y los webhooks se implementan en la fase del complemento.
 */
export const auco: IntegrationDef = {
  key: "auco",
  label: "AUCO (verificación de identidad)",
  description: "Validación de identidad de trabajadores. Complemento de plan pago.",
  fields: [
    {
      name: "apiBaseUrl",
      label: "URL base de la API",
      kind: "config",
      type: "url",
      required: true,
      defaults: {
        sandbox: "https://dev.auco.ai/v1.5/ext",
        production: "https://api.auco.ai/v1.5/ext",
      },
    },
    {
      name: "publicKey",
      label: "Llave pública (puk_...)",
      kind: "config",
      required: true,
      clientSafe: true,
      help: "Lecturas (GET). También es la llave pública que usa el SDK Aucoface en el navegador.",
    },
    {
      name: "privateKey",
      label: "Llave privada (prk_...)",
      kind: "secret",
      required: true,
      help: "Escrituras (POST/PUT/DELETE). Nunca se envía al navegador.",
    },
    {
      name: "webhookHeaderName",
      label: "Nombre del encabezado del webhook",
      kind: "config",
      defaults: { sandbox: "Authorization", production: "Authorization" },
      help: "El mismo encabezado que configures en AUCO para el webhook.",
    },
    {
      name: "webhookSecret",
      label: "Valor del encabezado del webhook",
      kind: "secret",
      help: "Valor que AUCO enviará en cada notificación; se compara para autenticar el webhook.",
    },
  ],
  helpers: (root) => [
    { label: "URL del webhook a registrar en AUCO", value: `https://${root}/api/webhooks/auco` },
  ],
  async test({ config, fetch: f }) {
    const base = String(config.apiBaseUrl ?? "").replace(/\/$/, "");
    const pub = String(config.publicKey ?? "");
    if (!base || !pub) return { ok: false, message: "Falta la URL base o la llave pública." };
    if (!pub.startsWith("puk_"))
      return { ok: false, message: "La llave pública debe empezar por puk_." };
    try {
      // GET /company: devuelve los datos de la organización asociada a la llave pública.
      const res = await fetchWithTimeout(f, `${base}/company`, { headers: { Authorization: pub } });
      if (res.status === 401)
        return {
          ok: false,
          message: "AUCO rechazó la llave (401). Revisa la llave y el ambiente.",
        };
      if (!res.ok) return { ok: false, message: `AUCO respondió ${res.status}.` };
      const body = (await res.json()) as { name?: string };
      return { ok: true, message: `Conexión correcta con la organización "${body.name ?? "—"}".` };
    } catch (e) {
      return networkError(e);
    }
  },
};
