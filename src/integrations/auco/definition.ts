import type { IntegrationDef } from "../registry/types";

/**
 * AUCO: verificación de identidad (complemento de plan pago: cargo fijo + variable por validación).
 * TODO-INTEGRACION: aún no se dispone de la documentación de la API de AUCO; los campos y la prueba de
 * conexión se completan cuando se tenga. Las credenciales ya se administran desde el panel.
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
    },
    { name: "apiKey", label: "API key", kind: "secret", required: true },
    { name: "apiSecret", label: "API secret (si aplica)", kind: "secret" },
    { name: "accountId", label: "ID de cuenta / comercio", kind: "config" },
  ],
  async test() {
    return {
      ok: false,
      message:
        "Prueba no implementada: falta la documentación de la API de AUCO (TODO-INTEGRACION).",
    };
  },
};
