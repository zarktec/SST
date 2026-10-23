/**
 * Reglas puras del ciclo de vida de la suscripción (spec 5.2):
 *   trial → activa → en mora (gracia configurable) → suspendida (solo lectura) → cancelada.
 * Sin I/O: el cron y el procesador de pagos llaman a estas funciones y persisten el resultado.
 */
import { bogotaDate } from "@/core/calendar/business-days";

export type SubStatus = "trialing" | "active" | "past_due" | "suspended" | "cancelled";

export type SubFacts = {
  status: SubStatus;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  graceEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
  hasPaymentSource: boolean;
};

export type BillingSettings = {
  /** Días de gracia tras fallar el cobro antes de suspender. */
  graceDays: number;
  /** Días que se conservan los datos tras cancelar antes de borrarlos (previa exportación). */
  retentionDays: number;
  /** Días tras el primer fallo en los que se reintenta el cobro (p. ej. 1, 3, 5). */
  retryDays: number[];
  /** none | daily_credit: prorrateo al subir de plan (crédito por los días no usados). */
  prorationMode: "none" | "daily_credit";
};

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  graceDays: 5,
  retentionDays: 90,
  retryDays: [1, 3, 5],
  prorationMode: "daily_credit",
};

export type Action =
  | { kind: "none" }
  | { kind: "charge"; reason: "trial_end" | "renewal" }
  | { kind: "suspend"; reason: "trial_expired" | "grace_expired" }
  | { kind: "cancel"; reason: "cancel_at_period_end" }
  | { kind: "mark_past_due"; reason: "no_payment_source" };

/** Qué debe hacer el barrido diario con esta suscripción en este instante. */
export function evaluate(s: SubFacts, now: Date): Action {
  switch (s.status) {
    case "cancelled":
    case "suspended":
      return { kind: "none" };
    case "trialing":
      if (s.trialEndsAt && now >= s.trialEndsAt) {
        // Con método de pago se cobra el plan elegido; sin él la cuenta pasa a solo lectura.
        return s.hasPaymentSource
          ? { kind: "charge", reason: "trial_end" }
          : { kind: "suspend", reason: "trial_expired" };
      }
      return { kind: "none" };
    case "active":
      if (s.currentPeriodEnd && now >= s.currentPeriodEnd) {
        if (s.cancelAtPeriodEnd) return { kind: "cancel", reason: "cancel_at_period_end" };
        return s.hasPaymentSource
          ? { kind: "charge", reason: "renewal" }
          : { kind: "mark_past_due", reason: "no_payment_source" };
      }
      return { kind: "none" };
    case "past_due":
      if (s.graceEndsAt && now >= s.graceEndsAt)
        return { kind: "suspend", reason: "grace_expired" };
      return { kind: "none" };
  }
}

export const graceEnd = (from: Date, graceDays: number) =>
  new Date(from.getTime() + graceDays * 86_400_000);

/** Suma meses calendario conservando el fin de mes (31-ene + 1 mes = 28/29-feb). */
export function addMonthsClamped(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, lastDay));
  return out;
}

export const periodMonths = (p: "monthly" | "annual") => (p === "monthly" ? 1 : 12);

/**
 * Nuevo fin de periodo al aprobarse un pago. Si se paga a tiempo, el periodo continúa desde el fin
 * anterior (sin regalar ni quitar días); si estaba vencido, arranca desde ahora.
 */
export function nextPeriod(prevEnd: Date | null, period: "monthly" | "annual", paidAt: Date) {
  const start = prevEnd && prevEnd > paidAt ? prevEnd : paidAt;
  return { start, end: addMonthsClamped(start, periodMonths(period)) };
}

export type TrialReminder = 7 | 3 | 1 | 0;
const REMINDER_DAYS: TrialReminder[] = [7, 3, 1, 0];

/**
 * Recordatorio de fin de trial pendiente: días 7, 3 y 1 antes y el día del vencimiento (calendario de
 * Colombia). Devuelve el más reciente aplicable que aún no se haya enviado (nunca reenvía anteriores).
 */
export function trialReminderDue(
  trialEndsAt: Date,
  now: Date,
  sent: number[],
): TrialReminder | null {
  const daysLeft = calendarDaysBetween(bogotaDate(now), bogotaDate(trialEndsAt));
  const candidates = REMINDER_DAYS.filter(
    (d) => daysLeft <= d && daysLeft >= 0 && !sent.includes(d),
  );
  // El más cercano al vencimiento entre los pendientes (menor d) si ya aplica.
  return candidates.length ? (Math.min(...candidates) as TrialReminder) : null;
}

/** Días calendario entre dos fechas ISO (to - from). */
function calendarDaysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export type PlanChangeEffect = "immediate" | "at_period_end";

/** Equivalente mensual (neto) para comparar planes de distinta periodicidad. */
export const monthlyEquivalent = (amountCents: bigint, period: "monthly" | "annual") =>
  period === "monthly" ? amountCents : amountCents / 12n;

/**
 * Subir de plan o pasar de mensual a anual aplica de inmediato; bajar de plan o pasar de anual a
 * mensual, al final del periodo vigente (spec 5.7).
 */
export function classifyChange(
  current: { monthlyEq: bigint; period: "monthly" | "annual" },
  target: { monthlyEq: bigint; period: "monthly" | "annual" },
): PlanChangeEffect {
  if (current.period === "annual" && target.period === "monthly") return "at_period_end";
  if (current.period === "monthly" && target.period === "annual") return "immediate";
  return target.monthlyEq > current.monthlyEq ? "immediate" : "at_period_end";
}

/** Crédito por los días no usados del periodo actual (prorrateo diario, redondeo hacia abajo). */
export function unusedCredit(
  amountCents: bigint,
  periodStart: Date,
  periodEnd: Date,
  now: Date,
): bigint {
  const total = periodEnd.getTime() - periodStart.getTime();
  if (total <= 0 || now >= periodEnd) return 0n;
  const remaining = periodEnd.getTime() - Math.max(now.getTime(), periodStart.getTime());
  return (amountCents * BigInt(remaining)) / BigInt(total);
}

export type CanWrite = { writable: boolean; reason?: "suspended" | "cancelled" };
/** Suspendida o cancelada = solo lectura. */
export function writability(status: SubStatus): CanWrite {
  if (status === "suspended") return { writable: false, reason: "suspended" };
  if (status === "cancelled") return { writable: false, reason: "cancelled" };
  return { writable: true };
}
