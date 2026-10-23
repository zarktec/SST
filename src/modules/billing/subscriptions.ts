import "server-only";
import { and, eq, inArray, ne } from "drizzle-orm";
import { schema, systemDb, withPlatform, type Tx } from "@/core/db";
import {
  DEFAULT_BILLING_SETTINGS,
  evaluate,
  graceEnd,
  nextPeriod,
  trialReminderDue,
  type Action,
  type BillingSettings,
  type SubStatus,
} from "./lifecycle";

const { subscription, subscriptionEvent, tenant, platformSetting } = schema;
type Sub = typeof subscription.$inferSelect;

const SYSTEM_ACTOR = "system";

/** subscription.status → tenant.status (el estado de la empresa se mantiene sincronizado). */
const TENANT_STATUS: Record<SubStatus, (typeof tenant.$inferSelect)["status"]> = {
  trialing: "trial",
  active: "active",
  past_due: "past_due",
  suspended: "suspended",
  cancelled: "cancelled",
};

export async function getBillingSettings(): Promise<BillingSettings> {
  const [row] = await systemDb()
    .select()
    .from(platformSetting)
    .where(eq(platformSetting.key, "billing"));
  return { ...DEFAULT_BILLING_SETTINGS, ...((row?.value as Partial<BillingSettings>) ?? {}) };
}

export async function saveBillingSettings(patch: Partial<BillingSettings>, actorId: string) {
  const merged = { ...(await getBillingSettings()), ...patch };
  await systemDb()
    .insert(platformSetting)
    .values({ key: "billing", value: merged, updatedBy: actorId })
    .onConflictDoUpdate({
      target: platformSetting.key,
      set: { value: merged, updatedBy: actorId, updatedAt: new Date() },
    });
  return merged;
}

type Change = Partial<typeof subscription.$inferInsert>;

/** Única vía para cambiar el estado: actualiza suscripción + empresa y deja el evento auditable. */
async function transition(
  tx: Tx,
  sub: Sub,
  to: SubStatus,
  type: string,
  change: Change,
  opts: { actorId?: string; data?: unknown; now: Date; retentionDays?: number },
) {
  await tx
    .update(subscription)
    .set({ ...change, status: to, updatedAt: opts.now })
    .where(eq(subscription.id, sub.id));
  const tenantPatch: Partial<typeof tenant.$inferInsert> = {
    status: TENANT_STATUS[to],
    updatedAt: opts.now,
  };
  if (to === "cancelled")
    tenantPatch.retentionUntil = new Date(
      opts.now.getTime() +
        (opts.retentionDays ?? DEFAULT_BILLING_SETTINGS.retentionDays) * 86_400_000,
    );
  if (sub.status === "cancelled" && to !== "cancelled") tenantPatch.retentionUntil = null;
  await tx.update(tenant).set(tenantPatch).where(eq(tenant.id, sub.tenantId));
  await tx.insert(subscriptionEvent).values({
    tenantId: sub.tenantId,
    subscriptionId: sub.id,
    type,
    fromStatus: sub.status,
    toStatus: to,
    data: opts.data ?? null,
    actorId: opts.actorId ?? SYSTEM_ACTOR,
    at: opts.now,
  });
}

async function load(tx: Tx, tenantId: string): Promise<Sub> {
  const [s] = await tx.select().from(subscription).where(eq(subscription.tenantId, tenantId));
  if (!s) throw new Error("La empresa no tiene suscripción");
  return s;
}

export type PlanSnapshot = {
  planId: string;
  period: "monthly" | "annual" | null;
  amountCents: bigint | null;
  vat: { enabled: boolean; included: boolean; rateBp: number };
};

/** Crea la suscripción en prueba (se llama dentro de la transacción de creación de la empresa). */
export async function createTrialSubscription(
  tx: Tx,
  tenantId: string,
  plan: PlanSnapshot & { trialDays: number },
  now = new Date(),
) {
  const trialEndsAt = new Date(now.getTime() + plan.trialDays * 86_400_000);
  const [row] = await tx
    .insert(subscription)
    .values({
      tenantId,
      planId: plan.planId,
      period: plan.period,
      status: "trialing",
      trialEndsAt,
      priceAmountCents: plan.amountCents,
      vatEnabled: plan.vat.enabled,
      vatIncluded: plan.vat.included,
      vatRateBp: plan.vat.rateBp,
    })
    .returning();
  await tx.insert(subscriptionEvent).values({
    tenantId,
    subscriptionId: row.id,
    type: "trial_started",
    toStatus: "trialing",
    data: { trialDays: plan.trialDays },
    actorId: SYSTEM_ACTOR,
    at: now,
  });
  await tx.update(tenant).set({ status: "trial" }).where(eq(tenant.id, tenantId));
  return row;
}

/** Pago aprobado (lo invoca el procesador de pagos de forma idempotente por referencia). */
export async function markPaid(
  tenantId: string,
  input: {
    period: "monthly" | "annual";
    paidAt?: Date;
    reference: string;
    snapshot?: Partial<Change>;
  },
) {
  const now = input.paidAt ?? new Date();
  return withPlatform(
    { actorId: SYSTEM_ACTOR, action: "billing.mark_paid", tenantId, reason: input.reference },
    async (tx) => {
      const sub = await load(tx, tenantId);
      const prevEnd = sub.status === "trialing" ? null : sub.currentPeriodEnd;
      const p = nextPeriod(prevEnd, input.period, now);
      await transition(
        tx,
        sub,
        "active",
        "payment_approved",
        {
          period: input.period,
          currentPeriodStart: p.start,
          currentPeriodEnd: p.end,
          graceEndsAt: null,
          trialEndsAt: null,
          ...input.snapshot,
        },
        { now, data: { reference: input.reference } },
      );
      return p;
    },
  );
}

export async function markPastDue(tenantId: string, reason: string, now = new Date()) {
  const settings = await getBillingSettings();
  return withPlatform(
    { actorId: SYSTEM_ACTOR, action: "billing.past_due", tenantId, reason },
    async (tx) => {
      const sub = await load(tx, tenantId);
      if (sub.status !== "active" && sub.status !== "past_due" && sub.status !== "trialing") return;
      await transition(
        tx,
        sub,
        "past_due",
        "payment_failed",
        { graceEndsAt: sub.graceEndsAt ?? graceEnd(now, settings.graceDays) },
        { now, data: { reason } },
      );
    },
  );
}

export async function suspend(
  tenantId: string,
  opts: { reason: string; actorId?: string; now?: Date },
) {
  const now = opts.now ?? new Date();
  return withPlatform(
    {
      actorId: opts.actorId ?? SYSTEM_ACTOR,
      action: "billing.suspend",
      tenantId,
      reason: opts.reason,
    },
    async (tx) => {
      const sub = await load(tx, tenantId);
      if (sub.status === "suspended" || sub.status === "cancelled") return;
      await transition(
        tx,
        sub,
        "suspended",
        "suspended",
        {},
        { now, actorId: opts.actorId, data: { reason: opts.reason } },
      );
    },
  );
}

/** Reactiva: vuelve a activa si hay periodo pagado vigente; a prueba si aún no vence; si no, queda suspendida. */
export async function reactivate(tenantId: string, opts: { actorId: string; now?: Date }) {
  const now = opts.now ?? new Date();
  return withPlatform(
    { actorId: opts.actorId, action: "billing.reactivate", tenantId },
    async (tx) => {
      const sub = await load(tx, tenantId);
      if (sub.status !== "suspended" && sub.status !== "cancelled" && sub.status !== "past_due")
        return sub.status;
      const to: SubStatus =
        sub.currentPeriodEnd && sub.currentPeriodEnd > now
          ? "active"
          : sub.trialEndsAt && sub.trialEndsAt > now
            ? "trialing"
            : "suspended";
      if (to === "suspended")
        throw new Error(
          "No hay periodo vigente: registra un pago, extiende la prueba o concede meses gratis",
        );
      await transition(
        tx,
        sub,
        to,
        "reactivated",
        { graceEndsAt: null, cancelAtPeriodEnd: false, cancelledAt: null },
        { now, actorId: opts.actorId },
      );
      return to;
    },
  );
}

export async function extendTrial(
  tenantId: string,
  days: number,
  opts: { actorId: string; now?: Date },
) {
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new Error("Días inválidos (1-365)");
  const now = opts.now ?? new Date();
  return withPlatform(
    { actorId: opts.actorId, action: "billing.extend_trial", tenantId, reason: String(days) },
    async (tx) => {
      const sub = await load(tx, tenantId);
      if (sub.status === "cancelled") throw new Error("La suscripción está cancelada");
      const from = sub.trialEndsAt && sub.trialEndsAt > now ? sub.trialEndsAt : now;
      const trialEndsAt = new Date(from.getTime() + days * 86_400_000);
      await transition(
        tx,
        sub,
        "trialing",
        "trial_extended",
        { trialEndsAt, trialRemindersSent: [], graceEndsAt: null },
        { now, actorId: opts.actorId, data: { days } },
      );
      return trialEndsAt;
    },
  );
}

/** Concede meses gratis: extiende el periodo vigente sin cobro. */
export async function grantFreeMonths(
  tenantId: string,
  months: number,
  opts: { actorId: string; now?: Date },
) {
  if (!Number.isInteger(months) || months < 1 || months > 36)
    throw new Error("Meses inválidos (1-36)");
  const now = opts.now ?? new Date();
  const { addMonthsClamped } = await import("./lifecycle");
  return withPlatform(
    {
      actorId: opts.actorId,
      action: "billing.grant_free_months",
      tenantId,
      reason: String(months),
    },
    async (tx) => {
      const sub = await load(tx, tenantId);
      if (sub.status === "cancelled") throw new Error("La suscripción está cancelada");
      const base =
        sub.currentPeriodEnd && sub.currentPeriodEnd > now && sub.status === "active"
          ? sub.currentPeriodEnd
          : now;
      const end = addMonthsClamped(base, months);
      await transition(
        tx,
        sub,
        "active",
        "free_months_granted",
        {
          currentPeriodStart:
            sub.status === "active" && sub.currentPeriodStart ? sub.currentPeriodStart : now,
          currentPeriodEnd: end,
          graceEndsAt: null,
          trialEndsAt: null,
          period: sub.period ?? "monthly",
        },
        { now, actorId: opts.actorId, data: { months } },
      );
      return end;
    },
  );
}

export async function cancel(
  tenantId: string,
  opts: { mode: "now" | "period_end"; actorId: string; now?: Date },
) {
  const now = opts.now ?? new Date();
  const settings = await getBillingSettings();
  return withPlatform(
    { actorId: opts.actorId, action: "billing.cancel", tenantId, reason: opts.mode },
    async (tx) => {
      const sub = await load(tx, tenantId);
      if (sub.status === "cancelled") return;
      if (opts.mode === "period_end" && sub.status === "active") {
        await tx
          .update(subscription)
          .set({ cancelAtPeriodEnd: true, updatedAt: now })
          .where(eq(subscription.id, sub.id));
        await tx.insert(subscriptionEvent).values({
          tenantId,
          subscriptionId: sub.id,
          type: "cancel_scheduled",
          fromStatus: sub.status,
          toStatus: sub.status,
          actorId: opts.actorId,
          at: now,
        });
        return;
      }
      await transition(
        tx,
        sub,
        "cancelled",
        "cancelled",
        { cancelledAt: now, cancelAtPeriodEnd: false },
        { now, actorId: opts.actorId, retentionDays: settings.retentionDays },
      );
    },
  );
}

export type SweepHandlers = {
  /** Pide un cobro (lo implementa el procesador de pagos). */
  requestCharge: (sub: Sub, reason: "trial_end" | "renewal") => Promise<void>;
  /** Envía el recordatorio de fin de trial (día 7, 3, 1 o 0). */
  sendTrialReminder: (sub: Sub, day: 7 | 3 | 1 | 0) => Promise<void>;
};

export type SweepResult = {
  evaluated: number;
  actions: { tenantId: string; action: Action["kind"]; reason?: string }[];
  reminders: { tenantId: string; day: number }[];
};

/** Barrido diario: evalúa cada suscripción abierta y ejecuta la acción que corresponda. Idempotente. */
export async function runLifecycleSweep(
  handlers: SweepHandlers,
  now = new Date(),
): Promise<SweepResult> {
  const subs = await withPlatform(
    { actorId: SYSTEM_ACTOR, action: "billing.sweep.read", audit: false },
    (tx) =>
      tx
        .select()
        .from(subscription)
        .where(
          and(
            ne(subscription.status, "cancelled"),
            inArray(subscription.status, ["trialing", "active", "past_due"]),
          ),
        ),
  );
  const result: SweepResult = { evaluated: subs.length, actions: [], reminders: [] };
  for (const sub of subs) {
    const action = evaluate(
      {
        status: sub.status,
        trialEndsAt: sub.trialEndsAt,
        currentPeriodEnd: sub.currentPeriodEnd,
        graceEndsAt: sub.graceEndsAt,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        hasPaymentSource: Boolean(sub.defaultPaymentSourceId),
      },
      now,
    );
    if (action.kind === "charge") await handlers.requestCharge(sub, action.reason);
    else if (action.kind === "suspend") await suspend(sub.tenantId, { reason: action.reason, now });
    else if (action.kind === "cancel")
      await cancel(sub.tenantId, { mode: "now", actorId: SYSTEM_ACTOR, now });
    else if (action.kind === "mark_past_due") await markPastDue(sub.tenantId, action.reason, now);
    if (action.kind !== "none")
      result.actions.push({
        tenantId: sub.tenantId,
        action: action.kind,
        reason: "reason" in action ? action.reason : undefined,
      });

    if (sub.status === "trialing" && sub.trialEndsAt) {
      const day = trialReminderDue(sub.trialEndsAt, now, sub.trialRemindersSent);
      if (day !== null) {
        await handlers.sendTrialReminder(sub, day);
        await withPlatform(
          {
            actorId: SYSTEM_ACTOR,
            action: "billing.trial_reminder",
            tenantId: sub.tenantId,
            reason: String(day),
          },
          (tx) =>
            tx
              .update(subscription)
              .set({ trialRemindersSent: [...sub.trialRemindersSent, day] })
              .where(eq(subscription.id, sub.id)),
        );
        result.reminders.push({ tenantId: sub.tenantId, day });
      }
    }
  }
  return result;
}
