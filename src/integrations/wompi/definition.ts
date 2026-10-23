import { fetchWithTimeout, networkError } from "../registry/http";
import type { IntegrationDef } from "../registry/types";

export const wompi: IntegrationDef = {
  key: "wompi",
  label: "Wompi (pagos)",
  description: "Pasarela de pagos: tokenización, fuentes de pago y cobro recurrente.",
  fields: [
    {
      name: "apiBaseUrl",
      label: "URL base de la API",
      kind: "config",
      type: "url",
      required: true,
      defaults: {
        sandbox: "https://sandbox.wompi.co/v1",
        production: "https://production.wompi.co/v1",
      },
    },
    {
      name: "publicKey",
      label: "Llave pública (pub_...)",
      kind: "config",
      required: true,
      clientSafe: true,
      help: "Es la única credencial que puede usarse en el navegador (tokenización).",
    },
    { name: "privateKey", label: "Llave privada (prv_...)", kind: "secret", required: true },
    {
      name: "eventsSecret",
      label: "Secreto de eventos",
      kind: "secret",
      required: true,
      help: "Verifica la firma de los webhooks.",
    },
    {
      name: "integritySecret",
      label: "Secreto de integridad",
      kind: "secret",
      required: true,
      help: "Firma las transacciones.",
    },
    {
      name: "paymentMethods",
      label: "Métodos de pago habilitados",
      kind: "config",
      type: "select",
      options: [
        { value: "CARD", label: "Tarjeta crédito/débito" },
        { value: "CARD,NEQUI", label: "Tarjeta y Nequi" },
      ],
      defaults: { sandbox: "CARD", production: "CARD" },
    },
  ],
  helpers: (root) => [
    {
      label: "URL de eventos (webhook) a registrar en Wompi",
      value: `https://${root}/api/webhooks/wompi`,
    },
  ],
  async test({ config, fetch: f }) {
    const base = String(config.apiBaseUrl ?? "").replace(/\/$/, "");
    const pub = String(config.publicKey ?? "");
    if (!base || !pub) return { ok: false, message: "Falta la URL base o la llave pública." };
    try {
      // GET /merchants/{llave_pública}: devuelve el comercio y los tokens de aceptación vigentes.
      const res = await fetchWithTimeout(f, `${base}/merchants/${encodeURIComponent(pub)}`);
      if (!res.ok)
        return {
          ok: false,
          message: `Wompi respondió ${res.status}. Revisa la llave pública y el ambiente.`,
        };
      const body = (await res.json()) as {
        data?: { name?: string; presigned_acceptance?: unknown };
      };
      if (!body.data?.presigned_acceptance)
        return { ok: false, message: "Respuesta inesperada de Wompi." };
      return { ok: true, message: `Conexión correcta con el comercio "${body.data.name ?? "—"}".` };
    } catch (e) {
      return networkError(e);
    }
  },
};
