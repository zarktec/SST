import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, schema, systemDb, withPlatform } from "@/core/db";
import { createTenant, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { createTrialSubscription, suspend, cancel } from "@/modules/billing/subscriptions";
import { createPlan } from "@/modules/platform/plans/service";
import {
  assertCanAdd,
  assertModuleEnabled,
  assertWritable,
  ModuleDisabledError,
  PlanLimitError,
  ReadOnlyError,
  usageOf,
  withinLimit,
} from "./limits";

pointToTestDb();

describe("withinLimit", () => {
  it("null = ilimitado", () => expect(withinLimit(null, 1_000_000)).toBe(true));
  it("justo en el límite sí; uno más no", () => {
    expect(withinLimit(5, 4)).toBe(true);
    expect(withinLimit(5, 5)).toBe(false);
    expect(withinLimit(5, 3, 2)).toBe(true);
    expect(withinLimit(5, 3, 3)).toBe(false);
  });
});

describe.skipIf(!hasTestDb)("límites, módulos y solo lectura en servidor", () => {
  let tenantId: string;
  beforeAll(async () => {
    const planId = await createPlan({
      key: "lim",
      name: "Limitado",
      description: "",
      isTrial: false,
      trialDays: null,
      vatEnabled: false,
      vatIncluded: false,
      vatRatePercent: 0,
      limits: { workers: 10, users: 2, centers: 1, storageMb: 1 },
      modules: ["planear", "hacer"],
      visible: true,
      sortOrder: 1,
      active: true,
      monthlyPesos: 100_000,
      annualPesos: null,
      monthlySiigoCode: null,
      annualSiigoCode: null,
    });
    const t = await createTenant("lim-co");
    tenantId = t.id;
    await withPlatform({ actorId: "t", action: "test", tenantId }, (tx) =>
      createTrialSubscription(tx, tenantId, {
        planId,
        period: "monthly",
        amountCents: 10_000_000n,
        vat: { enabled: false, included: false, rateBp: 0 },
        trialDays: 30,
      }),
    );
  });
  afterAll(closeDb);

  it("usuarios: permite hasta el límite y bloquea el siguiente con mensaje claro", async () => {
    const [role] = await withPlatform(
      { actorId: "t", action: "test", tenantId, audit: false },
      (tx) => tx.insert(schema.role).values({ tenantId, name: "R" }).returning(),
    );
    for (const id of ["lu1", "lu2"]) {
      await systemDb()
        .insert(schema.user)
        .values({ id, name: id, email: `${id}@x.co` });
      await assertCanAdd(tenantId, "users");
      await withPlatform({ actorId: "t", action: "test", tenantId, audit: false }, (tx) =>
        tx.insert(schema.membership).values({ tenantId, userId: id, roleId: role.id }),
      );
    }
    expect(await usageOf(tenantId, "users")).toBe(2);
    const err = await assertCanAdd(tenantId, "users").catch((e) => e);
    expect(err).toBeInstanceOf(PlanLimitError);
    expect(err.message).toMatch(/límite de usuarios de tu plan \(2\).*Actualiza tu plan/);
  });

  it("sedes y almacenamiento", async () => {
    await assertCanAdd(tenantId, "centers");
    await withPlatform({ actorId: "t", action: "test", tenantId, audit: false }, (tx) =>
      tx.insert(schema.workCenter).values({ tenantId, name: "Sede 1" }),
    );
    await expect(assertCanAdd(tenantId, "centers")).rejects.toBeInstanceOf(PlanLimitError);
    await withPlatform({ actorId: "t", action: "test", tenantId, audit: false }, (tx) =>
      tx.insert(schema.file).values({
        tenantId,
        blobKey: "k",
        name: "f.pdf",
        mime: "application/pdf",
        size: 2 * 1024 * 1024,
      }),
    );
    expect(await usageOf(tenantId, "storageMb")).toBe(2);
    await expect(assertCanAdd(tenantId, "storageMb")).rejects.toBeInstanceOf(PlanLimitError);
  });

  it("módulos: solo los incluidos en el plan", async () => {
    await expect(assertModuleEnabled(tenantId, "planear")).resolves.toBeUndefined();
    await expect(assertModuleEnabled(tenantId, "pesv")).rejects.toBeInstanceOf(ModuleDisabledError);
  });

  it("suspendida o cancelada = solo lectura; en prueba y en mora se puede escribir", async () => {
    await expect(assertWritable(tenantId)).resolves.toBeUndefined();
    await suspend(tenantId, { reason: "test" });
    const e = await assertWritable(tenantId).catch((x) => x);
    expect(e).toBeInstanceOf(ReadOnlyError);
    expect(e.message).toMatch(/suspendida/);
    await systemDb()
      .update(schema.subscription)
      .set({ status: "past_due" })
      .where(eq(schema.subscription.tenantId, tenantId));
    await expect(assertWritable(tenantId)).resolves.toBeUndefined();
    await cancel(tenantId, { mode: "now", actorId: "t" });
    await expect(assertWritable(tenantId)).rejects.toThrow(/cancelada/);
  });
});
