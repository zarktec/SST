import "server-only";
import { and, eq } from "drizzle-orm";
import { schema, systemDb } from "@/core/db";
import { sendMail } from "@/core/mail";
import { tenantUrl } from "@/core/tenancy/urls";
import type { SweepHandlers } from "./subscriptions";

const WHEN: Record<number, string> = { 7: "en 7 días", 3: "en 3 días", 1: "mañana", 0: "hoy" };

/** Correos de los administradores activos de la empresa (rol ADMIN_EMPRESA). */
export async function adminEmails(tenantId: string): Promise<string[]> {
  const rows = await systemDb()
    .select({ email: schema.user.email })
    .from(schema.membership)
    .innerJoin(schema.user, eq(schema.user.id, schema.membership.userId))
    .innerJoin(schema.role, eq(schema.role.id, schema.membership.roleId))
    .where(
      and(
        eq(schema.membership.tenantId, tenantId),
        eq(schema.membership.status, "active"),
        eq(schema.role.systemKey, "ADMIN_EMPRESA"),
      ),
    );
  return [...new Set(rows.map((r) => r.email))];
}

/** Handlers del barrido diario. El cobro real lo implementa el procesador de pagos (paso Wompi). */
export function billingHandlers(overrides: Partial<SweepHandlers> = {}): SweepHandlers {
  return {
    async requestCharge(sub, reason) {
      // Si la pasarela no está activa/configurada no se cobra ni se castiga a la empresa: se informa en el resumen del cron.
      const { chargeSubscription } = await import("./charging");
      const { getPaymentProvider } = await import("@/integrations/payments");
      await chargeSubscription(sub.tenantId, { reason, provider: getPaymentProvider() });
    },
    async sendTrialReminder(sub, day) {
      const billingUrl = await tenantUrl(sub.tenantId, "/facturacion");
      const to = await adminEmails(sub.tenantId);
      await Promise.all(
        to.map((email) =>
          sendMail({
            to: email,
            subject:
              day === 0
                ? "Tu prueba gratuita termina hoy"
                : `Tu prueba gratuita termina ${WHEN[day]}`,
            html: `<p>Tu prueba gratuita termina ${WHEN[day]}. Agrega un método de pago en <a href="${billingUrl}">Facturación</a> para continuar sin interrupciones; si no, tu cuenta pasará a solo lectura.</p>`,
          }),
        ),
      );
    },
    ...overrides,
  };
}
