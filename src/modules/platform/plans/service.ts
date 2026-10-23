import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { schema, systemDb } from "@/core/db";
import type { PlanLimits } from "@/core/plans/modules";
import type { CouponInputData, PlanInput } from "./schema";
import { percentToBp, pesosToCents, type VatConfig } from "./rules";

const { plan, planPrice, coupon } = schema;

export type PlanWithPrices = typeof plan.$inferSelect & {
  prices: {
    monthly: typeof planPrice.$inferSelect | null;
    annual: typeof planPrice.$inferSelect | null;
  };
};

function attachPrices(
  plans: (typeof plan.$inferSelect)[],
  prices: (typeof planPrice.$inferSelect)[],
): PlanWithPrices[] {
  return plans.map((p) => ({
    ...p,
    prices: {
      monthly: prices.find((x) => x.planId === p.id && x.period === "monthly") ?? null,
      annual: prices.find((x) => x.planId === p.id && x.period === "annual") ?? null,
    },
  }));
}

export async function listPlans(opts: { onlyVisible?: boolean } = {}): Promise<PlanWithPrices[]> {
  const db = systemDb();
  const conditions = [isNull(plan.deletedAt)];
  if (opts.onlyVisible) conditions.push(eq(plan.visible, true), eq(plan.active, true));
  const plans = await db
    .select()
    .from(plan)
    .where(and(...conditions))
    .orderBy(asc(plan.sortOrder), asc(plan.name));
  if (plans.length === 0) return [];
  const prices = await db
    .select()
    .from(planPrice)
    .where(
      inArray(
        planPrice.planId,
        plans.map((p) => p.id),
      ),
    );
  return attachPrices(plans, prices);
}

export async function getPlan(id: string): Promise<PlanWithPrices | null> {
  const db = systemDb();
  const [p] = await db
    .select()
    .from(plan)
    .where(and(eq(plan.id, id), isNull(plan.deletedAt)));
  if (!p) return null;
  const prices = await db.select().from(planPrice).where(eq(planPrice.planId, id));
  return attachPrices([p], prices)[0];
}

export async function getPlanByKey(key: string): Promise<PlanWithPrices | null> {
  const [p] = await systemDb()
    .select({ id: plan.id })
    .from(plan)
    .where(and(eq(plan.key, key), isNull(plan.deletedAt)));
  return p ? getPlan(p.id) : null;
}

export async function getTrialPlan(): Promise<PlanWithPrices | null> {
  const [p] = await systemDb()
    .select({ id: plan.id })
    .from(plan)
    .where(and(eq(plan.isTrial, true), eq(plan.active, true), isNull(plan.deletedAt)));
  return p ? getPlan(p.id) : null;
}

export const vatOf = (
  p: Pick<typeof plan.$inferSelect, "vatEnabled" | "vatIncluded" | "vatRateBp">,
): VatConfig => ({
  enabled: p.vatEnabled,
  included: p.vatIncluded,
  rateBp: p.vatRateBp,
});

function toPlanValues(input: PlanInput) {
  const limits: PlanLimits = input.limits;
  return {
    key: input.key,
    name: input.name,
    description: input.description,
    isTrial: input.isTrial,
    trialDays: input.trialDays,
    vatEnabled: input.vatEnabled,
    vatIncluded: input.vatEnabled && input.vatIncluded,
    vatRateBp: input.vatEnabled ? percentToBp(input.vatRatePercent) : 0,
    limits,
    modules: input.modules,
    visible: input.visible,
    sortOrder: input.sortOrder,
    active: input.active,
  };
}

async function upsertPrices(
  tx: Parameters<Parameters<ReturnType<typeof systemDb>["transaction"]>[0]>[0],
  planId: string,
  input: PlanInput,
) {
  const entries = [
    { period: "monthly" as const, pesos: input.monthlyPesos, code: input.monthlySiigoCode },
    { period: "annual" as const, pesos: input.annualPesos, code: input.annualSiigoCode },
  ];
  for (const e of entries) {
    if (e.pesos === null) {
      // Quitar un precio = desactivarlo (las suscripciones activas conservan su snapshot).
      await tx
        .update(planPrice)
        .set({ active: false })
        .where(and(eq(planPrice.planId, planId), eq(planPrice.period, e.period)));
      continue;
    }
    await tx
      .insert(planPrice)
      .values({
        planId,
        period: e.period,
        amountCents: pesosToCents(e.pesos),
        siigoProductCode: e.code,
        active: true,
      })
      .onConflictDoUpdate({
        target: [planPrice.planId, planPrice.period],
        set: {
          amountCents: pesosToCents(e.pesos),
          siigoProductCode: e.code,
          active: true,
          updatedAt: new Date(),
        },
      });
  }
}

function friendly(e: unknown): never {
  const msg =
    e instanceof Error ? `${e.message} ${(e as { cause?: Error }).cause?.message ?? ""}` : "";
  if (/plan_key_unique/.test(msg)) throw new Error("Ya existe un plan con esa clave");
  if (/plan_single_trial_uq/.test(msg))
    throw new Error("Ya existe un plan de prueba gratuita; desmarca el actual primero");
  throw e;
}

export async function createPlan(input: PlanInput): Promise<string> {
  try {
    return await systemDb().transaction(async (tx) => {
      const [row] = await tx.insert(plan).values(toPlanValues(input)).returning({ id: plan.id });
      await upsertPrices(tx, row.id, input);
      return row.id;
    });
  } catch (e) {
    friendly(e);
  }
}

export async function updatePlan(id: string, input: PlanInput): Promise<void> {
  try {
    await systemDb().transaction(async (tx) => {
      const values: Partial<ReturnType<typeof toPlanValues>> = toPlanValues(input);
      delete values.key; // la clave es inmutable
      const res = await tx
        .update(plan)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(plan.id, id), isNull(plan.deletedAt)))
        .returning({ id: plan.id });
      if (res.length === 0) throw new Error("Plan no encontrado");
      await upsertPrices(tx, id, input);
    });
  } catch (e) {
    friendly(e);
  }
}

/** Archiva (borrado lógico): las suscripciones existentes siguen apuntando al plan. */
export async function archivePlan(id: string): Promise<void> {
  await systemDb()
    .update(plan)
    .set({ deletedAt: new Date(), active: false, visible: false, isTrial: false })
    .where(eq(plan.id, id));
}

export async function listCoupons() {
  return systemDb().select().from(coupon).orderBy(asc(coupon.code));
}

export async function createCoupon(input: CouponInputData): Promise<string> {
  const value =
    input.kind === "percent" ? BigInt(percentToBp(input.value)) : pesosToCents(input.value);
  try {
    const [row] = await systemDb()
      .insert(coupon)
      .values({
        code: input.code.trim().toUpperCase(),
        description: input.description,
        kind: input.kind,
        value,
        validFrom: input.validFrom,
        validTo: input.validTo,
        maxUses: input.maxUses,
        planIds: input.planIds,
        active: input.active,
      })
      .returning({ id: coupon.id });
    return row.id;
  } catch (e) {
    if (
      /coupon_code_unique/.test(
        `${(e as Error).message} ${(e as { cause?: Error }).cause?.message ?? ""}`,
      )
    )
      throw new Error("Ya existe un cupón con ese código");
    throw e;
  }
}

export async function setCouponActive(id: string, active: boolean) {
  await systemDb().update(coupon).set({ active, updatedAt: new Date() }).where(eq(coupon.id, id));
}

/** Redime un cupón de forma atómica (respeta el máximo de usos aun con concurrencia). */
export async function redeemCoupon(
  code: string,
  planId: string,
  now = new Date(),
): Promise<{ ok: true; coupon: typeof coupon.$inferSelect } | { ok: false; reason: string }> {
  const { checkCoupon } = await import("./rules");
  const [c] = await systemDb()
    .select()
    .from(coupon)
    .where(eq(coupon.code, code.trim().toUpperCase()));
  if (!c) return { ok: false, reason: "not_found" };
  const check = checkCoupon(c, planId, now);
  if (!check.ok) return { ok: false, reason: check.reason };
  const res = await systemDb()
    .update(coupon)
    .set({ usedCount: sql`${coupon.usedCount} + 1`, updatedAt: now })
    .where(
      and(
        eq(coupon.id, c.id),
        sql`(${coupon.maxUses} IS NULL OR ${coupon.usedCount} < ${coupon.maxUses})`,
      ),
    )
    .returning();
  if (res.length === 0) return { ok: false, reason: "exhausted" };
  return { ok: true, coupon: res[0] };
}

/** Planes iniciales (idempotente: no pisa lo que el SUPER ADMIN ya haya editado). */
export async function seedPlans() {
  const db = systemDb();
  const exists = async (key: string) =>
    (await db.select({ id: plan.id }).from(plan).where(eq(plan.key, key))).length > 0;
  if (!(await exists("free-trial"))) {
    await createPlan({
      key: "free-trial",
      name: "Free Trial",
      description: "Prueba gratuita con todos los módulos.",
      isTrial: true,
      trialDays: 30,
      vatEnabled: false,
      vatIncluded: false,
      vatRatePercent: 0,
      limits: { workers: null, users: null, centers: null, storageMb: null },
      modules: [
        "planear",
        "hacer",
        "verificar",
        "actuar",
        "documentos",
        "reportes",
        "portal_trabajador",
        "pesv",
        "verificacion_identidad",
      ],
      visible: false,
      sortOrder: 0,
      active: true,
      monthlyPesos: null,
      annualPesos: null,
      monthlySiigoCode: null,
      annualSiigoCode: null,
    });
  }
  if (!(await exists("profesional"))) {
    // El SUPER ADMIN ajusta precio, IVA (aplica / incluido / %) y periodicidades desde el panel.
    await createPlan({
      key: "profesional",
      name: "Profesional",
      description: "SG-SST completo para tu empresa.",
      isTrial: false,
      trialDays: null,
      vatEnabled: true,
      vatIncluded: false,
      vatRatePercent: 19,
      limits: { workers: null, users: null, centers: null, storageMb: null },
      modules: [
        "planear",
        "hacer",
        "verificar",
        "actuar",
        "documentos",
        "reportes",
        "portal_trabajador",
        "pesv",
      ],
      visible: true,
      sortOrder: 10,
      active: true,
      monthlyPesos: 200_000,
      annualPesos: null,
      monthlySiigoCode: null,
      annualSiigoCode: null,
    });
  }
}
