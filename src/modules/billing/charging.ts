import "server-only";
import { and, asc, desc, eq, isNotNull, lt, lte, or } from "drizzle-orm";
import { bogotaDate } from "@/core/calendar/business-days";
import { schema, withPlatform, type Tx } from "@/core/db";
import type { PaymentProvider, ProviderTransaction } from "@/integrations/payments/types";
import { quote, type CouponInput } from "@/modules/platform/plans/rules";
import { vatOf } from "@/modules/platform/plans/service";
import { getBillingSettings, markPaid, markPastDue } from "./subscriptions";

const { subscription, payment, paymentSource, plan, planPrice, subscriptionEvent, tenant } = schema;
export type Payment = typeof payment.$inferSelect;
type Sub = typeof subscription.$inferSelect;
const SYSTEM = "system";
const DAY = 86_400_000;

/** Ganchos que otros módulos registran (facturación electrónica, notificaciones). Fallar aquí NO deshace el cobro. */
export const paymentHooks: {
  onApproved: ((p: Payment) => Promise<void>)[];
  onFailed: ((
    p: Payment,
    info: { willRetryAt: Date | null; exhausted: boolean },
  ) => Promise<void>)[];
} = { onApproved: [], onFailed: [] };

async function runHooks<T extends unknown[]>(hooks: ((...a: T) => Promise<void>)[], ...args: T) {
  for (const h of hooks) await h(...args).catch((e) => console.error("[billing] hook falló:", e));
}

export const periodKeyOf = (sub: Pick<Sub, "currentPeriodEnd" | "trialEndsAt">): string | null => {
  const d = sub.currentPeriodEnd ?? sub.trialEndsAt;
  return d ? bogotaDate(d) : null;
};

/** SUB-{suscripción}-{AAAAMMDD}; los reintentos agregan -R2, -R3… (la pasarela no admite referencias repetidas). */
export function referenceFor(subscriptionId: string, periodKey: string, attempt: number): string {
  return `SUB-${subscriptionId}-${periodKey.replaceAll("-", "")}${attempt > 1 ? `-R${attempt}` : ""}`;
}

type ChargeQuote = {
  planId: string;
  period: "monthly" | "annual";
  couponId: string | null;
  listAmountCents: bigint;
  netCents: bigint;
  vatCents: bigint;
  totalCents: bigint;
  discountCents: bigint;
  vat: { enabled: boolean; included: boolean; rateBp: number };
};

/**
 * Qué se cobra en este ciclo: el plan/periodicidad elegidos (o el actual) al precio de lista VIGENTE (un cambio de
 * precio aplica en la renovación), con IVA configurado y cupón solo en el primer pago aprobado.
 */
async function quoteCharge(tx: Tx, sub: Sub): Promise<ChargeQuote | null> {
  const planId = sub.scheduledPlanId ?? sub.planId;
  const period = sub.scheduledPeriod ?? sub.period;
  if (!period) return null;
  const [pl] = await tx.select().from(plan).where(eq(plan.id, planId));
  if (!pl || pl.isTrial) return null; // sin plan de pago elegido
  const [price] = await tx
    .select()
    .from(planPrice)
    .where(
      and(eq(planPrice.planId, planId), eq(planPrice.period, period), eq(planPrice.active, true)),
    );
  if (!price) return null;
  const vat = vatOf(pl);
  let cpn: CouponInput | null = null;
  let couponId: string | null = null;
  if (sub.couponId && sub.couponKind && sub.couponValue) {
    const paid = await tx
      .select({ id: payment.id })
      .from(payment)
      .where(and(eq(payment.subscriptionId, sub.id), eq(payment.status, "approved")))
      .limit(1);
    if (paid.length === 0) {
      cpn = { kind: sub.couponKind, value: sub.couponValue };
      couponId = sub.couponId;
    }
  }
  const q = quote(price.amountCents, vat, cpn);
  return {
    planId,
    period,
    couponId,
    listAmountCents: price.amountCents,
    netCents: q.netCents,
    vatCents: q.vatCents,
    totalCents: q.totalCents,
    discountCents: q.discountCents,
    vat,
  };
}

async function ownerEmail(tx: Tx, tenantId: string): Promise<string> {
  const rows = await tx
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
    )
    .orderBy(asc(schema.membership.createdAt))
    .limit(1);
  if (rows[0]) return rows[0].email;
  const [t] = await tx.select({ slug: tenant.slug }).from(tenant).where(eq(tenant.id, tenantId));
  return `facturacion+${t?.slug ?? "empresa"}@sst.zark.pro`;
}

export type ChargeReason = "trial_end" | "renewal" | "retry" | "manual";
export type ChargeOutcome =
  | {
      kind: "skipped";
      reason:
        | "no_subscription"
        | "no_period"
        | "no_plan_selected"
        | "already_paid"
        | "pending"
        | "not_due"
        | "no_source"
        | "attempts_exhausted"
        | "concurrent"
        | "not_billable";
    }
  | { kind: "charged"; payment: Payment };

/**
 * Cobra el ciclo vigente de una suscripción. Idempotente: (suscripción, ciclo, intento) es único; si ya hay un cobro
 * aprobado o pendiente en el ciclo no hace nada. Elige la fuente (predeterminada, luego respaldo) según los intentos previos.
 */
export async function chargeSubscription(
  tenantId: string,
  opts: { reason: ChargeReason; provider: PaymentProvider; now?: Date; paymentSourceId?: string },
): Promise<ChargeOutcome> {
  const now = opts.now ?? new Date();
  const settings = await getBillingSettings();
  const prep = await withPlatform(
    { actorId: SYSTEM, action: "billing.charge.prepare", tenantId, audit: false },
    async (tx) => {
      const [sub] = await tx.select().from(subscription).where(eq(subscription.tenantId, tenantId));
      if (!sub) return { skip: "no_subscription" as const };
      if (opts.reason !== "manual" && !["trialing", "active", "past_due"].includes(sub.status))
        return { skip: "not_billable" as const };
      if (sub.status === "cancelled") return { skip: "not_billable" as const };
      const periodKey = periodKeyOf(sub);
      if (!periodKey) return { skip: "no_period" as const };
      // Solo se cobra un ciclo vencido: un barrido repetido justo después de pagar no debe cobrar el ciclo siguiente.
      const end = sub.currentPeriodEnd ?? sub.trialEndsAt;
      const due =
        Boolean(end && now >= end) || (opts.reason === "manual" && sub.status === "trialing");
      if (!due) return { skip: "not_due" as const };
      const prior = await tx
        .select()
        .from(payment)
        .where(and(eq(payment.subscriptionId, sub.id), eq(payment.periodKey, periodKey)))
        .orderBy(asc(payment.attempt));
      if (prior.some((p) => p.status === "approved")) return { skip: "already_paid" as const };
      if (prior.some((p) => p.status === "pending")) return { skip: "pending" as const };
      const last = prior.at(-1);
      if (last && opts.reason === "retry" && (!last.nextRetryAt || last.nextRetryAt > now))
        return { skip: last.nextRetryAt ? ("not_due" as const) : ("attempts_exhausted" as const) };
      // Cotización: los reintentos del mismo ciclo conservan el monto del primer intento.
      const first = prior[0];
      const q = first
        ? {
            planId: first.planId,
            period: first.period,
            couponId: first.couponId,
            listAmountCents: first.netCents + first.discountCents,
            netCents: first.netCents,
            vatCents: first.vatCents,
            totalCents: first.totalCents,
            discountCents: first.discountCents,
            vat: { enabled: false, included: false, rateBp: 0 },
          }
        : await quoteCharge(tx, sub);
      if (!q) return { skip: "no_plan_selected" as const };

      const attempt = (last?.attempt ?? 0) + 1;
      const defaultAttempts = prior.filter((p) => p.sourceRole === "default").length;
      const maxDefault = 1 + settings.retryDays.length;
      let sourceId: string | null = opts.paymentSourceId ?? null;
      let role: "default" | "backup" | "manual" = opts.reason === "manual" ? "manual" : "default";
      if (!sourceId) {
        if (opts.reason !== "manual" && defaultAttempts >= maxDefault) {
          if (prior.some((p) => p.sourceRole === "backup") || !sub.backupPaymentSourceId)
            return { skip: "attempts_exhausted" as const };
          sourceId = sub.backupPaymentSourceId;
          role = "backup";
        } else sourceId = sub.defaultPaymentSourceId;
      }
      if (!sourceId) return { skip: "no_source" as const };
      const [src] = await tx
        .select()
        .from(paymentSource)
        .where(
          and(
            eq(paymentSource.id, sourceId),
            eq(paymentSource.tenantId, tenantId),
            eq(paymentSource.active, true),
          ),
        );
      if (!src) return { skip: "no_source" as const };
      const email = await ownerEmail(tx, tenantId);
      return { sub, periodKey, q, attempt, role, src, email, prior };
    },
  );
  if ("skip" in prep && prep.skip) return { kind: "skipped", reason: prep.skip };
  const { sub, periodKey, q, attempt, role, src, email } = prep as Exclude<
    typeof prep,
    { skip: string }
  >;

  const reference = referenceFor(sub.id, periodKey, attempt);
  const { nextPeriod } = await import("./lifecycle");
  const per = nextPeriod(sub.status === "trialing" ? null : sub.currentPeriodEnd, q.period, now);

  // 1) Registrar el intento ANTES de llamar a la pasarela (la unicidad evita dobles cobros concurrentes).
  const created = await withPlatform(
    { actorId: SYSTEM, action: "billing.charge.create", tenantId, reason: reference },
    async (tx) => {
      const rows = await tx
        .insert(payment)
        .values({
          tenantId,
          subscriptionId: sub.id,
          planId: q.planId,
          period: q.period,
          periodKey,
          attempt,
          sourceRole: role,
          paymentSourceId: src.id,
          reference,
          status: "pending",
          netCents: q.netCents,
          vatCents: q.vatCents,
          totalCents: q.totalCents,
          discountCents: q.discountCents,
          couponId: q.couponId,
          periodStart: per.start,
          periodEnd: per.end,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning();
      // El intento anterior ya cumplió su reintento: así el cron no lo vuelve a seleccionar.
      if (rows[0])
        await tx
          .update(payment)
          .set({ nextRetryAt: null })
          .where(
            and(
              eq(payment.subscriptionId, sub.id),
              eq(payment.periodKey, periodKey),
              lt(payment.attempt, attempt),
            ),
          );
      return rows[0] ?? null;
    },
  );
  if (!created) return { kind: "skipped", reason: "concurrent" };

  // Cobro sin valor (cupón del 100 %): se aprueba sin pasar por la pasarela.
  if (q.totalCents === 0n) {
    const done = await applyTransaction(
      created.id,
      { providerTxId: `free-${reference}`, reference, status: "approved", amountCents: 0n },
      { now },
    );
    return { kind: "charged", payment: done ?? created };
  }

  // 2) Cobrar. Un fallo de red cuenta como intento fallido (se reintenta con otra referencia).
  let result: ProviderTransaction;
  try {
    result = await opts.provider.charge({
      amountCents: q.totalCents,
      reference,
      customerEmail: email,
      providerSourceId: src.providerSourceId,
      recurrent: true,
    });
  } catch (e) {
    result = {
      providerTxId: "",
      reference,
      status: "error",
      amountCents: q.totalCents,
      message: e instanceof Error ? e.message : "Error de comunicación con la pasarela",
    };
  }
  const done = await applyTransaction(created.id, result, { now });
  return { kind: "charged", payment: done ?? created };
}

/**
 * Aplica el resultado de una transacción a un cobro. Idempotente y solo avanza: pending → (approved | declined | error |
 * voided); approved → voided. Reaplicar el mismo estado no hace nada (webhooks repetidos o fuera de orden).
 */
export async function applyTransaction(
  paymentId: string,
  tx: ProviderTransaction,
  opts: { now?: Date } = {},
): Promise<Payment | null> {
  const now = opts.now ?? new Date();
  const settings = await getBillingSettings();
  type Step = {
    updated: Payment;
    became: "approved" | "failed" | null;
    duplicate: boolean;
    retry: { at: Date | null; exhausted: boolean };
  };
  const step = await withPlatform(
    { actorId: SYSTEM, action: "billing.payment.apply", audit: false },
    async (db): Promise<Step | null> => {
      // Bloqueo de fila: dos eventos simultáneos sobre el mismo cobro se procesan en serie.
      const [p] = await db.select().from(payment).where(eq(payment.id, paymentId)).for("update");
      if (!p) return null;
      if (tx.amountCents !== p.totalCents && tx.status === "approved") {
        await db
          .update(payment)
          .set({
            providerPayload: {
              error: "monto_distinto",
              expected: String(p.totalCents),
              got: String(tx.amountCents),
            },
            updatedAt: now,
          })
          .where(eq(payment.id, p.id));
        throw new Error(
          `El monto aprobado (${tx.amountCents}) no coincide con el cobro (${p.totalCents})`,
        );
      }
      const order = { pending: 0, error: 1, declined: 1, approved: 2, voided: 3 } as const;
      if (
        p.status === tx.status ||
        order[tx.status] < order[p.status] ||
        (p.status !== "pending" && p.status !== "approved")
      ) {
        // Mismo estado, retroceso o intento ya final: no cambia nada (solo completa el id de la pasarela si faltaba).
        if (!p.providerTxId && tx.providerTxId)
          await db
            .update(payment)
            .set({ providerTxId: tx.providerTxId, updatedAt: now })
            .where(eq(payment.id, p.id));
        return {
          updated: p,
          became: null,
          duplicate: false,
          retry: { at: null, exhausted: false },
        };
      }
      const base = {
        providerTxId: tx.providerTxId || p.providerTxId,
        status: tx.status,
        declineReason:
          tx.status === "declined" || tx.status === "error"
            ? (tx.message ?? p.declineReason ?? "Rechazado")
            : p.declineReason,
        providerPayload: { status: tx.status, message: tx.message ?? null },
        updatedAt: now,
      };
      if (tx.status === "approved") {
        const [same] = await db
          .select({ id: payment.id })
          .from(payment)
          .where(
            and(
              eq(payment.subscriptionId, p.subscriptionId),
              eq(payment.periodKey, p.periodKey),
              eq(payment.status, "approved"),
            ),
          );
        const [updated] = await db
          .update(payment)
          .set({
            ...base,
            nextRetryAt: null,
            ...(same ? { providerPayload: { ...base.providerPayload, refundRequired: true } } : {}),
          })
          .where(eq(payment.id, p.id))
          .returning();
        if (same) {
          await db.insert(subscriptionEvent).values({
            tenantId: p.tenantId,
            subscriptionId: p.subscriptionId,
            type: "duplicate_charge",
            data: { paymentId: p.id, reference: p.reference },
            actorId: SYSTEM,
            at: now,
          });
          return { updated, became: null, duplicate: true, retry: { at: null, exhausted: false } };
        }
        return {
          updated,
          became: "approved",
          duplicate: false,
          retry: { at: null, exhausted: false },
        };
      }
      if (tx.status === "declined" || tx.status === "error") {
        // Reintentos: días 1, 3, 5… desde el primer fallo del ciclo; luego el método de respaldo; luego mora/suspensión.
        const cycle = await db
          .select()
          .from(payment)
          .where(
            and(eq(payment.subscriptionId, p.subscriptionId), eq(payment.periodKey, p.periodKey)),
          )
          .orderBy(asc(payment.attempt));
        const firstAt = cycle[0].createdAt;
        const defaultDone = cycle.filter((c) => c.sourceRole === "default").length; // incluye este intento
        const [sub] = await db
          .select()
          .from(subscription)
          .where(eq(subscription.id, p.subscriptionId));
        let nextAt: Date | null = null;
        if (p.sourceRole === "default" && defaultDone <= settings.retryDays.length)
          nextAt = new Date(firstAt.getTime() + settings.retryDays[defaultDone - 1] * DAY);
        else if (
          p.sourceRole === "default" &&
          sub.backupPaymentSourceId &&
          !cycle.some((c) => c.sourceRole === "backup")
        )
          nextAt = now;
        const [updated] = await db
          .update(payment)
          .set({ ...base, nextRetryAt: nextAt })
          .where(eq(payment.id, p.id))
          .returning();
        return {
          updated,
          became: "failed",
          duplicate: false,
          retry: { at: nextAt, exhausted: nextAt === null },
        };
      }
      const [updated] = await db.update(payment).set(base).where(eq(payment.id, p.id)).returning();
      return { updated, became: null, duplicate: false, retry: { at: null, exhausted: false } };
    },
  );
  if (!step) return null;
  const { updated, became, retry } = step;

  if (became === "approved") {
    const [pl] = await withPlatform(
      { actorId: SYSTEM, action: "billing.payment.plan", audit: false },
      (db) => db.select().from(plan).where(eq(plan.id, updated.planId)),
    );
    await markPaid(updated.tenantId, {
      period: updated.period,
      paidAt: now,
      reference: updated.reference,
      snapshot: {
        planId: updated.planId,
        period: updated.period,
        priceAmountCents: updated.netCents + updated.discountCents,
        vatEnabled: pl.vatEnabled,
        vatIncluded: pl.vatIncluded,
        vatRateBp: pl.vatRateBp,
        scheduledPlanId: null,
        scheduledPeriod: null,
        ...(updated.couponId ? { couponId: null, couponKind: null, couponValue: null } : {}),
      },
    });
    await runHooks(paymentHooks.onApproved, updated);
  } else if (became === "failed") {
    // Primer fallo del ciclo → mora (la gracia incluye el calendario de reintentos).
    await markPastDue(
      updated.tenantId,
      `Cobro rechazado: ${updated.declineReason ?? "sin detalle"}`,
      now,
    );
    await runHooks(paymentHooks.onFailed, updated, {
      willRetryAt: retry.at,
      exhausted: retry.exhausted,
    });
  }
  return updated;
}

/** Reintentos vencidos (cron diario): cobros rechazados cuyo `nextRetryAt` ya llegó. */
export async function retryDueCharges(provider: PaymentProvider, now = new Date()) {
  const due = await withPlatform(
    { actorId: SYSTEM, action: "billing.retry.read", audit: false },
    (tx) =>
      tx
        .selectDistinct({ tenantId: payment.tenantId })
        .from(payment)
        .innerJoin(subscription, eq(subscription.id, payment.subscriptionId))
        .where(
          and(
            or(eq(payment.status, "declined"), eq(payment.status, "error")),
            isNotNull(payment.nextRetryAt),
            lte(payment.nextRetryAt, now),
            eq(subscription.status, "past_due"),
          ),
        ),
  );
  const out: { tenantId: string; outcome: ChargeOutcome["kind"] | string }[] = [];
  for (const { tenantId } of due) {
    const r = await chargeSubscription(tenantId, { reason: "retry", provider, now });
    out.push({
      tenantId,
      outcome: r.kind === "skipped" ? `skipped:${r.reason}` : r.payment.status,
    });
  }
  return out;
}

export async function listPayments(tenantId: string, opts: { limit?: number } = {}) {
  return withPlatform(
    { actorId: SYSTEM, action: "billing.payments.list", tenantId, audit: false },
    (tx) =>
      tx
        .select()
        .from(payment)
        .where(eq(payment.tenantId, tenantId))
        .orderBy(desc(payment.createdAt))
        .limit(opts.limit ?? 100),
  );
}
