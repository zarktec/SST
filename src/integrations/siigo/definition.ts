import { fetchWithTimeout, networkError } from "../registry/http";
import type { IntegrationDef } from "../registry/types";

export const siigo: IntegrationDef = {
  key: "siigo",
  label: "Siigo (facturación electrónica DIAN)",
  description: "Factura electrónica automática por cada pago aprobado.",
  fields: [
    {
      name: "apiBaseUrl",
      label: "URL base de la API",
      kind: "config",
      type: "url",
      required: true,
      defaults: { sandbox: "https://api.siigo.com", production: "https://api.siigo.com" },
    },
    { name: "username", label: "Usuario de API", kind: "config", required: true },
    { name: "accessKey", label: "Access key", kind: "secret", required: true },
    {
      name: "partnerId",
      label: "Partner-Id",
      kind: "config",
      required: true,
      help: "Siigo lo exige como encabezado en cada request.",
    },
    { name: "invoiceTypeId", label: "ID tipo de comprobante (FV)", kind: "config", type: "number" },
    {
      name: "creditNoteTypeId",
      label: "ID tipo de comprobante (NC)",
      kind: "config",
      type: "number",
    },
    {
      name: "productCode",
      label: "Código del producto/servicio en Siigo",
      kind: "config",
      required: true,
      help: "Producto de servicio (suscripción SaaS) creado previamente en Siigo.",
    },
    { name: "sellerId", label: "ID del vendedor", kind: "config", type: "number" },
    { name: "vatTaxId", label: "ID del impuesto IVA", kind: "config", type: "number" },
    { name: "paymentMethodId", label: "ID forma de pago (Wompi)", kind: "config", type: "number" },
    { name: "costCenterId", label: "Centro de costo (opcional)", kind: "config", type: "number" },
    {
      name: "autoSendDian",
      label: "Enviar automáticamente a la DIAN",
      kind: "config",
      type: "boolean",
      defaults: { sandbox: true, production: true },
    },
    {
      name: "sendEmail",
      label: "Enviar la factura por correo desde Siigo",
      kind: "config",
      type: "boolean",
      defaults: { sandbox: false, production: false },
    },
  ],
  async test({ config, secrets, fetch: f }) {
    const base = String(config.apiBaseUrl ?? "").replace(/\/$/, "");
    const username = String(config.username ?? "");
    const partnerId = String(config.partnerId ?? "");
    const accessKey = secrets.accessKey;
    if (!base || !username || !partnerId || !accessKey) {
      return { ok: false, message: "Faltan usuario, access key, Partner-Id o URL base." };
    }
    try {
      const res = await fetchWithTimeout(f, `${base}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Partner-Id": partnerId },
        body: JSON.stringify({ username, access_key: accessKey }),
      });
      if (!res.ok)
        return { ok: false, message: `Siigo rechazó las credenciales (HTTP ${res.status}).` };
      const body = (await res.json()) as { access_token?: string };
      return body.access_token
        ? { ok: true, message: "Autenticación correcta con Siigo." }
        : { ok: false, message: "Siigo no devolvió un access token." };
    } catch (e) {
      return networkError(e);
    }
  },
};
