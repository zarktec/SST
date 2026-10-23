import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { schema, withPlatform } from "@/core/db";
import type { PaymentProvider } from "@/integrations/payments/types";
import { priceBreakdown } from "@/modules/platform/plans/rules";
import { getPlan, vatOf } from "@/modules/platform/plans/service";
import { chargeSubscription, type ChargeOutcome } from "./charging";
import { listSources } from "./payment-sources";
import { cancel } from "./subscriptions";

const { subscription, subscriptionEvent, payment, plan } = schema;
const plat = (action: string, tenantId: string, actorId = "system", audit = false) => ({
  actorId,
  action,
  tenantId,
  audit,
});

export class PortalError extends Error {}

/** Todo lo que muestra "Mi plan" a la empresa. */
export async function getPortalOverview(tenantId: string) {
  const [sub, pays] = await withPlatform(plat("billing.portal.read", tenantId), (tx) =>
    Promise.all([
      tx.select().from(subscription).where(eq(subscription.tenantId, tenantId)),
      tx
        .select()
        .from(payment)
        .where(eq(payment.tenantId, tenantId))
        .orderBy(desc(payment.createdAt))
        .limit(100),
    ]),
  );
  const s = sub[0];
  if (!s) return null;
  const [current, scheduled, sources] = await Promise.all([
    getPlan(s.planId),
    s.scheduledPlanId ? getPlan(s.scheduledPlanId) : null,
    listSources(tenantId),
  ]);
  const next = scheduled ?? current;
  const period = s.scheduledPeriod ?? s.period;
  const price = period && next && !next.isTrial ? next.prices[period] : null;
  const nextCharge = price ? priceBreakdown(price.amountCents, vatOf(next!)) : null;
  return {
    subscription: s,
    plan: current,
    scheduledPlan: scheduled,
    nextPeriod: period,
    nextCharge,
    sources,
    payments: pays,
  };
}

/**
 * Elige plan/periodicidad. En prueba o sin plan de pago se cobra al terminar la prueba; con suscripción activa el
 * cambio queda programado para la próxima renovación (sin prorrateo).
 * TODO-NORMA/NEGOCIO: el dueño aún no define prorrateo de mejoras de plan a mitad de ciclo; por ahora no hay cobro intermedio.
 */
export async function selectPlan(
  tenantId: string,
  actorId: string,
  input: { planId: string; period: "monthly" | "annual" },
) {
  const p = await getPlan(input.planId);
  if (!p || !p.active || p.isTrial || !p.visible) throw new PortalError("Plan no disponible");
  if (!p.prices[input.period]?.active)
    throw new PortalError("Ese plan no tiene precio para la periodicidad elegida");
  await withPlatform(plat("billing.plan.select", tenantId, actorId, true), async (tx) => {
    const [sub] = await tx.select().from(subscription).where(eq(subscription.tenantId, tenantId));
    if (!sub || sub.status === "cancelled") throw new PortalError("La suscripción está cancelada");
    await tx
      .update(subscription)
      .set({ scheduledPlanId: p.id, scheduledPeriod: input.period, updatedAt: new Date() })
      .where(eq(subscription.id, sub.id));
    await tx.insert(subscriptionEvent).values({
      tenantId,
      subscriptionId: sub.id,
      type: "plan_scheduled",
      fromStatus: sub.status,
      toStatus: sub.status,
      actorId,
      at: new Date(),
    });
  });
}

/** Cancelación pedida por la empresa: al final del periodo pagado (en prueba, de inmediato). */
export async function requestCancellation(tenantId: string, actorId: string) {
  const [sub] = await withPlatform(plat("billing.portal.read", tenantId), (tx) =>
    tx.select().from(subscription).where(eq(subscription.tenantId, tenantId)),
  );
  if (!sub) throw new PortalError("Sin suscripción");
  await cancel(tenantId, { mode: sub.status === "active" ? "period_end" : "now", actorId });
}

/** Deshace una cancelación programada antes de que termine el periodo. */
export async function undoCancellation(tenantId: string, actorId: string) {
  await withPlatform(plat("billing.cancel.undo", tenantId, actorId, true), (tx) =>
    tx
      .update(subscription)
      .set({ cancelAtPeriodEnd: false, updatedAt: new Date() })
      .where(and(eq(subscription.tenantId, tenantId), eq(subscription.cancelAtPeriodEnd, true))),
  );
}

/** "Pagar ahora": cobra el ciclo vigente (o el fin de la prueba) con el método elegido. */
export async function payNow(
  tenantId: string,
  provider: PaymentProvider,
  paymentSourceId?: string,
): Promise<ChargeOutcome> {
  return chargeSubscription(tenantId, { reason: "manual", provider, paymentSourceId });
}

const csvCell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;

/** Historial de pagos en CSV (abre en Excel; BOM para tildes). */
export async function paymentsCsv(tenantId: string): Promise<string> {
  const rows = await withPlatform(plat("billing.payments.export", tenantId), (tx) =>
    tx
      .select({ p: payment, plan: plan.name, invoice: schema.invoice.number })
      .from(payment)
      .innerJoin(plan, eq(plan.id, payment.planId))
      .leftJoin(
        schema.invoice,
        and(eq(schema.invoice.paymentId, payment.id), eq(schema.invoice.kind, "invoice")),
      )
      .where(eq(payment.tenantId, tenantId))
      .orderBy(desc(payment.createdAt)),
  );
  const money = (c: bigint) => (Number(c) / 100).toFixed(2);
  const head = [
    "Fecha",
    "Referencia",
    "Plan",
    "Periodo",
    "Estado",
    "Neto",
    "IVA",
    "Total",
    "Factura",
  ];
  const lines = rows.map(({ p, plan: name, invoice }) =>
    [
      p.createdAt.toISOString(),
      p.reference,
      name,
      p.period,
      p.status,
      money(p.netCents),
      money(p.vatCents),
      money(p.totalCents),
      invoice,
    ]
      .map(csvCell)
      .join(","),
  );
  return "﻿" + [head.map(csvCell).join(","), ...lines].join("\r\n");
}
