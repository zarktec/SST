import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, schema, systemDb } from "@/core/db";
import { hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import type { PlanInput } from "./schema";
import { planInputSchema } from "./schema";
import {
  archivePlan,
  createCoupon,
  createPlan,
  getPlan,
  getPlanByKey,
  getTrialPlan,
  listPlans,
  redeemCoupon,
  seedPlans,
  updatePlan,
} from "./service";

pointToTestDb();

const base: PlanInput = {
  key: "pro",
  name: "Pro",
  description: "",
  isTrial: false,
  trialDays: null,
  vatEnabled: true,
  vatIncluded: false,
  vatRatePercent: 19,
  limits: { workers: 100, users: null, centers: null, storageMb: 5000 },
  modules: ["planear", "hacer"],
  visible: true,
  sortOrder: 1,
  active: true,
  monthlyPesos: 200_000,
  annualPesos: 2_000_000,
  monthlySiigoCode: "SRV-M",
  annualSiigoCode: "SRV-A",
};

describe("validación de entrada de planes", () => {
  it("exige un precio en planes de pago", () => {
    expect(
      planInputSchema.safeParse({ ...base, monthlyPesos: null, annualPesos: null }).success,
    ).toBe(false);
  });
  it("IVA incluido requiere IVA habilitado y tarifa", () => {
    expect(
      planInputSchema.safeParse({ ...base, vatEnabled: false, vatIncluded: true }).success,
    ).toBe(false);
    expect(planInputSchema.safeParse({ ...base, vatRatePercent: 0 }).success).toBe(false);
  });
  it("el plan de prueba exige duración", () => {
    expect(
      planInputSchema.safeParse({
        ...base,
        isTrial: true,
        monthlyPesos: null,
        annualPesos: null,
        trialDays: null,
      }).success,
    ).toBe(false);
    expect(
      planInputSchema.safeParse({
        ...base,
        isTrial: true,
        monthlyPesos: null,
        annualPesos: null,
        trialDays: 30,
      }).success,
    ).toBe(true);
  });
  it("rechaza claves y módulos inválidos", () => {
    expect(planInputSchema.safeParse({ ...base, key: "Mi Plan" }).success).toBe(false);
    expect(planInputSchema.safeParse({ ...base, modules: ["inexistente"] }).success).toBe(false);
  });
});

describe.skipIf(!hasTestDb)("servicio de planes y cupones", () => {
  beforeEach(async () => {
    await systemDb().delete(schema.planPrice);
    await systemDb().delete(schema.plan);
    await systemDb().delete(schema.coupon);
  });
  afterAll(closeDb);

  it("crea un plan con precios mensual y anual independientes (en centavos)", async () => {
    const id = await createPlan(base);
    const p = (await getPlan(id))!;
    expect(p.vatRateBp).toBe(1900);
    expect(p.prices.monthly?.amountCents).toBe(20_000_000n);
    expect(p.prices.annual?.amountCents).toBe(200_000_000n);
    expect(p.prices.monthly?.siigoProductCode).toBe("SRV-M");
  });

  it("quitar un precio lo desactiva y cambiarlo actualiza el monto", async () => {
    const id = await createPlan(base);
    await updatePlan(id, { ...base, annualPesos: null, monthlyPesos: 250_000 });
    const p = (await getPlan(id))!;
    expect(p.prices.annual?.active).toBe(false);
    expect(p.prices.monthly?.amountCents).toBe(25_000_000n);
  });

  it("la clave es única y no cambia al editar", async () => {
    const id = await createPlan(base);
    await expect(createPlan(base)).rejects.toThrow(/Ya existe un plan con esa clave/);
    await updatePlan(id, { ...base, key: "otra", name: "Nuevo nombre" });
    expect((await getPlan(id))?.key).toBe("pro");
    expect((await getPlan(id))?.name).toBe("Nuevo nombre");
  });

  it("solo puede haber un plan de prueba activo", async () => {
    const trial = {
      ...base,
      key: "trial",
      isTrial: true,
      trialDays: 14,
      monthlyPesos: null,
      annualPesos: null,
      vatEnabled: false,
      vatIncluded: false,
    };
    await createPlan(trial);
    await expect(createPlan({ ...trial, key: "trial2" })).rejects.toThrow(
      /plan de prueba gratuita/,
    );
    expect((await getTrialPlan())?.trialDays).toBe(14);
  });

  it("archivar oculta el plan del listado y libera el plan de prueba", async () => {
    const id = await createPlan({
      ...base,
      key: "trial",
      isTrial: true,
      trialDays: 30,
      monthlyPesos: null,
      annualPesos: null,
    });
    await archivePlan(id);
    expect(await listPlans()).toEqual([]);
    expect(await getTrialPlan()).toBeNull();
  });

  it("el listado público solo muestra planes visibles y activos", async () => {
    await createPlan(base);
    await createPlan({ ...base, key: "oculto", visible: false });
    await createPlan({ ...base, key: "inactivo", active: false });
    expect((await listPlans({ onlyVisible: true })).map((p) => p.key)).toEqual(["pro"]);
    expect(await getPlanByKey("oculto")).not.toBeNull();
  });

  it("el seed crea Free Trial (30 días) y Profesional ($200.000/mes) sin pisar ediciones", async () => {
    await seedPlans();
    const pro = (await getPlanByKey("profesional"))!;
    expect(pro.prices.monthly?.amountCents).toBe(20_000_000n);
    expect(pro.prices.annual).toBeNull();
    const trial = (await getTrialPlan())!;
    expect(trial.trialDays).toBe(30);
    expect(trial.limits).toEqual({ workers: null, users: null, centers: null, storageMb: null });
    await updatePlan(pro.id, {
      ...base,
      key: "profesional",
      name: "Profesional Plus",
      monthlyPesos: 300_000,
      annualPesos: null,
    });
    await seedPlans();
    const again = (await getPlanByKey("profesional"))!;
    expect(again.name).toBe("Profesional Plus");
    expect(again.prices.monthly?.amountCents).toBe(30_000_000n);
    expect(await listPlans()).toHaveLength(2);
  });

  it("cupones: el código se normaliza y respeta vigencia, plan y máximo de usos", async () => {
    const planId = await createPlan(base);
    await createCoupon({
      code: "bienvenida10",
      description: "",
      kind: "percent",
      value: 10,
      validFrom: null,
      validTo: null,
      maxUses: 1,
      planIds: [planId],
      active: true,
    });
    await expect(
      createCoupon({
        code: "BIENVENIDA10",
        description: "",
        kind: "percent",
        value: 5,
        validFrom: null,
        validTo: null,
        maxUses: null,
        planIds: [],
        active: true,
      }),
    ).rejects.toThrow(/Ya existe un cupón/);
    expect(await redeemCoupon("x", planId)).toEqual({ ok: false, reason: "not_found" });
    expect(await redeemCoupon(" bienvenida10 ", "otro-plan")).toEqual({
      ok: false,
      reason: "wrong_plan",
    });
    const ok = await redeemCoupon(" bienvenida10 ", planId);
    expect(ok.ok).toBe(true);
    expect(ok.ok && ok.coupon.value).toBe(1000n);
    expect(await redeemCoupon("BIENVENIDA10", planId)).toEqual({ ok: false, reason: "exhausted" });
  });

  it("el máximo de usos se respeta bajo concurrencia", async () => {
    const planId = await createPlan(base);
    await createCoupon({
      code: "UNICO",
      description: "",
      kind: "amount",
      value: 10_000,
      validFrom: null,
      validTo: null,
      maxUses: 3,
      planIds: [],
      active: true,
    });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => redeemCoupon("UNICO", planId)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    const [c] = await systemDb().select().from(schema.coupon);
    expect(c.usedCount).toBe(3);
  });
});
