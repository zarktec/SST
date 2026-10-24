import "server-only";
import { sendMail } from "@/core/mail";
import { formatCOP, formatDate } from "@/lib/format";
import { tenantUrl } from "@/core/tenancy/urls";
import { adminEmails } from "./handlers";
import { getInvoicingProvider } from "@/integrations/invoicing";
import { paymentHooks, type Payment } from "./charging";
import { invoiceApprovedPayment } from "./invoicing";

let registered = false;

async function billingUrl(tenantId: string) {
  return tenantUrl(tenantId, "/facturacion");
}

async function notify(tenantId: string, subject: string, html: string) {
  await Promise.all((await adminEmails(tenantId)).map((to) => sendMail({ to, subject, html })));
}

/** Avisos de cobro a la empresa. Idempotente: se puede llamar desde cada ruta que procese pagos. */
export function registerBillingHooks() {
  if (registered) return;
  registered = true;
  paymentHooks.onFailed.push(async (p: Payment, info) => {
    const link = await billingUrl(p.tenantId);
    const next = info.willRetryAt
      ? `Volveremos a intentarlo el ${formatDate(info.willRetryAt)}.`
      : "Agotamos los reintentos automáticos: actualiza tu método de pago para evitar la suspensión de tu cuenta.";
    await notify(
      p.tenantId,
      "No pudimos procesar tu pago",
      `<p>El cobro de ${formatCOP(p.totalCents)} fue rechazado${p.declineReason ? ` (${p.declineReason})` : ""}.</p><p>${next}</p><p><a href="${link}">Ir a Facturación</a> para reintentar con "Pagar ahora" o usar otro método de pago.</p>`,
    );
  });
  // Factura electrónica: si Siigo no responde o no está configurado, queda pendiente y la conciliación diaria la reintenta.
  paymentHooks.onApproved.push((p: Payment) => invoiceApprovedPayment(p, getInvoicingProvider()));
  paymentHooks.onApproved.push(async (p: Payment) => {
    await notify(
      p.tenantId,
      "Recibimos tu pago",
      `<p>Recibimos tu pago de ${formatCOP(p.totalCents)}. Tu suscripción está activa. Pronto recibirás tu factura electrónica.</p>`,
    );
  });
}
