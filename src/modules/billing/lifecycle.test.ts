import { describe, expect, it } from "vitest";
import {
  addMonthsClamped,
  classifyChange,
  evaluate,
  monthlyEquivalent,
  nextPeriod,
  trialReminderDue,
  unusedCredit,
  writability,
  type SubFacts,
} from "./lifecycle";

const d = (s: string) => new Date(s);
const base: SubFacts = {
  status: "trialing",
  trialEndsAt: d("2026-11-01T05:00:00Z"),
  currentPeriodEnd: null,
  graceEndsAt: null,
  cancelAtPeriodEnd: false,
  hasPaymentSource: false,
};

describe("evaluate (barrido diario)", () => {
  it("trial vigente: nada que hacer", () => {
    expect(evaluate(base, d("2026-10-30T00:00:00Z"))).toEqual({ kind: "none" });
  });
  it("fin de trial sin método de pago → suspende (solo lectura)", () => {
    expect(evaluate(base, d("2026-11-01T05:00:00Z"))).toEqual({
      kind: "suspend",
      reason: "trial_expired",
    });
  });
  it("fin de trial con método de pago → cobra el plan elegido", () => {
    expect(evaluate({ ...base, hasPaymentSource: true }, d("2026-11-02T00:00:00Z"))).toEqual({
      kind: "charge",
      reason: "trial_end",
    });
  });
  const active: SubFacts = {
    ...base,
    status: "active",
    trialEndsAt: null,
    currentPeriodEnd: d("2026-12-01T05:00:00Z"),
    hasPaymentSource: true,
  };
  it("activa antes de vencer: nada", () =>
    expect(evaluate(active, d("2026-11-30T00:00:00Z"))).toEqual({ kind: "none" }));
  it("activa al vencer con método de pago → cobra renovación", () =>
    expect(evaluate(active, d("2026-12-01T05:00:00Z"))).toEqual({
      kind: "charge",
      reason: "renewal",
    }));
  it("activa al vencer sin método de pago → mora", () =>
    expect(evaluate({ ...active, hasPaymentSource: false }, d("2026-12-02T00:00:00Z"))).toEqual({
      kind: "mark_past_due",
      reason: "no_payment_source",
    }));
  it("cancelación programada se ejecuta al final del periodo", () =>
    expect(evaluate({ ...active, cancelAtPeriodEnd: true }, d("2026-12-01T05:00:00Z"))).toEqual({
      kind: "cancel",
      reason: "cancel_at_period_end",
    }));
  it("mora dentro de la gracia no suspende; vencida la gracia sí", () => {
    const pd: SubFacts = { ...active, status: "past_due", graceEndsAt: d("2026-12-06T05:00:00Z") };
    expect(evaluate(pd, d("2026-12-05T00:00:00Z"))).toEqual({ kind: "none" });
    expect(evaluate(pd, d("2026-12-06T05:00:00Z"))).toEqual({
      kind: "suspend",
      reason: "grace_expired",
    });
  });
  it("suspendida y cancelada no cambian solas", () => {
    expect(evaluate({ ...active, status: "suspended" }, d("2030-01-01"))).toEqual({ kind: "none" });
    expect(evaluate({ ...active, status: "cancelled" }, d("2030-01-01"))).toEqual({ kind: "none" });
  });
});

describe("periodos", () => {
  it("suma meses conservando fin de mes", () => {
    expect(addMonthsClamped(d("2026-01-31T10:00:00Z"), 1).toISOString()).toBe(
      "2026-02-28T10:00:00.000Z",
    );
    expect(addMonthsClamped(d("2028-01-31T10:00:00Z"), 1).toISOString()).toBe(
      "2028-02-29T10:00:00.000Z",
    );
    expect(addMonthsClamped(d("2026-03-15T10:00:00Z"), 12).toISOString()).toBe(
      "2027-03-15T10:00:00.000Z",
    );
  });
  it("pago a tiempo continúa desde el fin anterior", () => {
    const r = nextPeriod(d("2026-12-01T05:00:00Z"), "monthly", d("2026-11-30T12:00:00Z"));
    expect(r.start.toISOString()).toBe("2026-12-01T05:00:00.000Z");
    expect(r.end.toISOString()).toBe("2027-01-01T05:00:00.000Z");
  });
  it("pago tardío arranca desde el pago", () => {
    const r = nextPeriod(d("2026-12-01T05:00:00Z"), "annual", d("2026-12-04T12:00:00Z"));
    expect(r.start.toISOString()).toBe("2026-12-04T12:00:00.000Z");
    expect(r.end.toISOString()).toBe("2027-12-04T12:00:00.000Z");
  });
  it("primer pago (sin periodo previo) arranca ahora", () => {
    expect(nextPeriod(null, "monthly", d("2026-11-01T00:00:00Z")).end.toISOString()).toBe(
      "2026-12-01T00:00:00.000Z",
    );
  });
});

describe("recordatorios de fin de trial (7, 3, 1 y 0 días)", () => {
  const end = d("2026-11-10T20:00:00Z"); // 10-nov 15:00 en Bogotá
  it("antes del día 7 no hay recordatorio", () =>
    expect(trialReminderDue(end, d("2026-11-02T15:00:00Z"), [])).toBeNull());
  it("día 7", () => expect(trialReminderDue(end, d("2026-11-03T15:00:00Z"), [])).toBe(7));
  it("no reenvía el ya enviado", () =>
    expect(trialReminderDue(end, d("2026-11-04T15:00:00Z"), [7])).toBeNull());
  it("día 3, día 1 y día del vencimiento", () => {
    expect(trialReminderDue(end, d("2026-11-07T15:00:00Z"), [7])).toBe(3);
    expect(trialReminderDue(end, d("2026-11-09T15:00:00Z"), [7, 3])).toBe(1);
    expect(trialReminderDue(end, d("2026-11-10T13:00:00Z"), [7, 3, 1])).toBe(0);
  });
  it("si el cron falló varios días, manda el más cercano sin repetir los intermedios", () => {
    expect(trialReminderDue(end, d("2026-11-09T15:00:00Z"), [])).toBe(1);
  });
  it("usa el día calendario de Colombia (no UTC)", () => {
    // 11-nov 02:00 UTC = 10-nov 21:00 Bogotá → todavía es el día del vencimiento
    expect(trialReminderDue(end, d("2026-11-11T02:00:00Z"), [7, 3, 1])).toBe(0);
  });
  it("después del vencimiento ya no recuerda", () =>
    expect(trialReminderDue(end, d("2026-11-12T15:00:00Z"), [])).toBeNull());
});

describe("cambio de plan o periodicidad", () => {
  const m = (c: bigint, p: "monthly" | "annual" = "monthly") => ({
    monthlyEq: monthlyEquivalent(c, p),
    period: p,
  });
  it("subir de plan: inmediato", () =>
    expect(classifyChange(m(20_000_000n), m(40_000_000n))).toBe("immediate"));
  it("bajar de plan: al final del periodo", () =>
    expect(classifyChange(m(40_000_000n), m(20_000_000n))).toBe("at_period_end"));
  it("mensual → anual: inmediato", () =>
    expect(classifyChange(m(20_000_000n), m(200_000_000n, "annual"))).toBe("immediate"));
  it("anual → mensual: al final del periodo", () =>
    expect(classifyChange(m(200_000_000n, "annual"), m(20_000_000n))).toBe("at_period_end"));
  it("mismo plan y periodo: al final (sin efecto inmediato)", () =>
    expect(classifyChange(m(20_000_000n), m(20_000_000n))).toBe("at_period_end"));
});

describe("prorrateo", () => {
  const start = d("2026-11-01T00:00:00Z");
  const end = d("2026-12-01T00:00:00Z");
  it("mitad del periodo = mitad del valor", () =>
    expect(unusedCredit(30_000_000n, start, end, d("2026-11-16T00:00:00Z"))).toBe(15_000_000n));
  it("sin consumir = valor completo", () =>
    expect(unusedCredit(30_000_000n, start, end, d("2026-10-31T00:00:00Z"))).toBe(30_000_000n));
  it("vencido = 0", () =>
    expect(unusedCredit(30_000_000n, start, end, d("2026-12-02T00:00:00Z"))).toBe(0n));
  it("periodo inválido = 0", () =>
    expect(unusedCredit(30_000_000n, end, start, d("2026-11-16T00:00:00Z"))).toBe(0n));
});

describe("solo lectura", () => {
  it("suspendida y cancelada no escriben", () => {
    expect(writability("suspended")).toEqual({ writable: false, reason: "suspended" });
    expect(writability("cancelled")).toEqual({ writable: false, reason: "cancelled" });
    expect(writability("past_due").writable).toBe(true);
    expect(writability("trialing").writable).toBe(true);
  });
});
