import { describe, expect, it } from "vitest";
import { checkCoupon, percentToBp, pesosToCents, priceBreakdown, quote } from "./rules";

const vat19 = { enabled: true, included: false, rateBp: 1900 };

describe("priceBreakdown", () => {
  it("IVA aparte: $200.000 + 19 % = $238.000", () => {
    expect(priceBreakdown(pesosToCents(200_000), vat19)).toEqual({
      netCents: 20_000_000n,
      vatCents: 3_800_000n,
      totalCents: 23_800_000n,
    });
  });
  it("IVA incluido: $238.000 descompone en 200.000 + 38.000", () => {
    const b = priceBreakdown(pesosToCents(238_000), { ...vat19, included: true });
    expect(b).toEqual({ netCents: 20_000_000n, vatCents: 3_800_000n, totalCents: 23_800_000n });
  });
  it("IVA incluido: neto + IVA siempre suma el total (sin descuadres por redondeo)", () => {
    for (const total of [1n, 99n, 100n, 119_999n, 23_800_001n, 99_999_999n]) {
      const b = priceBreakdown(total, { ...vat19, included: true });
      expect(b.netCents + b.vatCents).toBe(total);
      expect(b.totalCents).toBe(total);
    }
  });
  it("sin IVA: neto = total", () => {
    expect(priceBreakdown(5_000n, { enabled: false, included: false, rateBp: 1900 })).toEqual({
      netCents: 5_000n,
      vatCents: 0n,
      totalCents: 5_000n,
    });
  });
  it("tarifa 0 se trata como sin IVA", () => {
    expect(priceBreakdown(5_000n, { enabled: true, included: true, rateBp: 0 }).vatCents).toBe(0n);
  });
  it("redondea half-up en centavos", () => {
    // 1 centavo * 19 % = 0,19 → 0
    expect(priceBreakdown(1n, vat19).vatCents).toBe(0n);
    // 3 centavos * 19 % = 0,57 → 1
    expect(priceBreakdown(3n, vat19).vatCents).toBe(1n);
  });
  it("rechaza montos negativos", () => {
    expect(() => priceBreakdown(-1n, vat19)).toThrow();
  });
});

describe("quote (cupones)", () => {
  it("10 % sobre el neto y el IVA se recalcula", () => {
    const q = quote(pesosToCents(200_000), vat19, { kind: "percent", value: 1000n });
    expect(q.discountCents).toBe(2_000_000n);
    expect(q.netCents).toBe(18_000_000n);
    expect(q.vatCents).toBe(3_420_000n);
    expect(q.totalCents).toBe(21_420_000n);
  });
  it("valor fijo", () => {
    const q = quote(pesosToCents(200_000), vat19, { kind: "amount", value: pesosToCents(50_000) });
    expect(q.netCents).toBe(15_000_000n);
    expect(q.totalCents).toBe(17_850_000n);
  });
  it("el descuento no puede superar el neto (total 0, nunca negativo)", () => {
    const q = quote(pesosToCents(100_000), vat19, { kind: "amount", value: pesosToCents(500_000) });
    expect(q).toMatchObject({ netCents: 0n, vatCents: 0n, totalCents: 0n });
  });
  it("100 % de descuento = gratis", () => {
    expect(quote(pesosToCents(200_000), vat19, { kind: "percent", value: 10000n }).totalCents).toBe(
      0n,
    );
  });
  it("sin cupón no cambia el precio", () => {
    expect(quote(pesosToCents(200_000), vat19).totalCents).toBe(23_800_000n);
  });
  it("con IVA incluido el descuento aplica al neto derivado", () => {
    const q = quote(
      pesosToCents(238_000),
      { ...vat19, included: true },
      { kind: "percent", value: 1000n },
    );
    expect(q.netCents).toBe(18_000_000n);
    expect(q.totalCents).toBe(21_420_000n);
  });
});

describe("checkCoupon", () => {
  const base = {
    active: true,
    validFrom: null,
    validTo: null,
    maxUses: null,
    usedCount: 0,
    planIds: [],
  };
  const now = new Date("2026-06-01T00:00:00Z");
  it("válido", () => expect(checkCoupon(base, "p1", now)).toEqual({ ok: true }));
  it("inactivo", () =>
    expect(checkCoupon({ ...base, active: false }, "p1", now)).toEqual({
      ok: false,
      reason: "inactive",
    }));
  it("aún no vigente", () =>
    expect(checkCoupon({ ...base, validFrom: new Date("2026-07-01") }, "p1", now)).toEqual({
      ok: false,
      reason: "not_started",
    }));
  it("vencido", () =>
    expect(checkCoupon({ ...base, validTo: new Date("2026-05-01") }, "p1", now)).toEqual({
      ok: false,
      reason: "expired",
    }));
  it("agotado", () =>
    expect(checkCoupon({ ...base, maxUses: 5, usedCount: 5 }, "p1", now)).toEqual({
      ok: false,
      reason: "exhausted",
    }));
  it("restringido a otros planes", () =>
    expect(checkCoupon({ ...base, planIds: ["p2"] }, "p1", now)).toEqual({
      ok: false,
      reason: "wrong_plan",
    }));
  it("restringido a este plan", () =>
    expect(checkCoupon({ ...base, planIds: ["p1"] }, "p1", now)).toEqual({ ok: true }));
});

describe("conversiones", () => {
  it("pesos y porcentajes", () => {
    expect(pesosToCents(200_000)).toBe(20_000_000n);
    expect(percentToBp(19)).toBe(1900);
    expect(percentToBp(19.5)).toBe(1950);
  });
});
