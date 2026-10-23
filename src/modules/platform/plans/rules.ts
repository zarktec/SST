/**
 * Reglas puras de precio: IVA configurable y cupones. Todo en enteros (centavos) con redondeo
 * half-up; nunca flotantes para dinero.
 */
export type VatConfig = { enabled: boolean; included: boolean; rateBp: number };
export type Breakdown = { netCents: bigint; vatCents: bigint; totalCents: bigint };

/** a/b redondeado half-up para enteros no negativos. */
function divRound(a: bigint, b: bigint): bigint {
  return (a * 2n + b) / (2n * b);
}

/** Descompone un precio de lista en neto, IVA y total según la configuración de IVA del plan. */
export function priceBreakdown(amountCents: bigint, vat: VatConfig): Breakdown {
  if (amountCents < 0n) throw new Error("El monto no puede ser negativo");
  if (!vat.enabled || vat.rateBp === 0)
    return { netCents: amountCents, vatCents: 0n, totalCents: amountCents };
  const rate = BigInt(vat.rateBp);
  if (vat.included) {
    const net = divRound(amountCents * 10000n, 10000n + rate);
    return { netCents: net, vatCents: amountCents - net, totalCents: amountCents };
  }
  const vatCents = divRound(amountCents * rate, 10000n);
  return { netCents: amountCents, vatCents, totalCents: amountCents + vatCents };
}

export type CouponInput = { kind: "percent" | "amount"; value: bigint };

export type Quote = Breakdown & { listNetCents: bigint; discountCents: bigint };

/**
 * Cotización: el cupón descuenta sobre el valor NETO (antes de IVA) y el IVA se recalcula sobre el
 * neto con descuento. TODO-NORMA: confirmar con contador el tratamiento tributario de descuentos.
 */
export function quote(amountCents: bigint, vat: VatConfig, coupon?: CouponInput | null): Quote {
  const base = priceBreakdown(amountCents, vat);
  let discount = 0n;
  if (coupon) {
    discount =
      coupon.kind === "percent" ? divRound(base.netCents * coupon.value, 10000n) : coupon.value;
    if (discount > base.netCents) discount = base.netCents;
  }
  const net = base.netCents - discount;
  const vatCents = vat.enabled ? divRound(net * BigInt(vat.rateBp), 10000n) : 0n;
  return {
    listNetCents: base.netCents,
    discountCents: discount,
    netCents: net,
    vatCents,
    totalCents: net + vatCents,
  };
}

export type CouponState = {
  active: boolean;
  validFrom: Date | null;
  validTo: Date | null;
  maxUses: number | null;
  usedCount: number;
  planIds: string[];
};

export type CouponCheck =
  | { ok: true }
  | { ok: false; reason: "inactive" | "not_started" | "expired" | "exhausted" | "wrong_plan" };

export function checkCoupon(c: CouponState, planId: string, now = new Date()): CouponCheck {
  if (!c.active) return { ok: false, reason: "inactive" };
  if (c.validFrom && now < c.validFrom) return { ok: false, reason: "not_started" };
  if (c.validTo && now > c.validTo) return { ok: false, reason: "expired" };
  if (c.maxUses !== null && c.usedCount >= c.maxUses) return { ok: false, reason: "exhausted" };
  if (c.planIds.length > 0 && !c.planIds.includes(planId))
    return { ok: false, reason: "wrong_plan" };
  return { ok: true };
}

/** Pesos (entero) → centavos. */
export const pesosToCents = (pesos: number): bigint => BigInt(Math.round(pesos)) * 100n;
/** Porcentaje (p. ej. 19 o 19.5) → puntos básicos. */
export const percentToBp = (pct: number): number => Math.round(pct * 100);
