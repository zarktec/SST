import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, schema, systemDb, withPlatform, withTenant } from "@/core/db";
import { createTenant, dbErrorMessage, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { createPlan } from "@/modules/platform/plans/service";
import {
  cancel,
  createTrialSubscription,
  extendTrial,
  getBillingSettings,
  grantFreeMonths,
  markPaid,
  markPastDue,
  reactivate,
  runLifecycleSweep,
  saveBillingSettings,
  suspend,
} from "./subscriptions";

pointToTestDb();
const d = (s: string) => new Date(s);
const noop = {
  requestCharge: vi.fn(async () => undefined),
  sendTrialReminder: vi.fn(async () => undefined),
};

describe.skipIf(!hasTestDb)("ciclo de vida de suscripciones (persistencia)", () => {
  let planId: string;
  beforeAll(async () => {
    planId = await createPlan({
      key: "sub-test",
      name: "Sub test",
      description: "",
      isTrial: false,
      trialDays: null,
      vatEnabled: true,
      vatIncluded: false,
      vatRatePercent: 19,
      limits: { workers: null, users: null, centers: null, storageMb: null },
      modules: [],
      visible: true,
      sortOrder: 1,
      active: true,
      monthlyPesos: 200_000,
      annualPesos: null,
      monthlySiigoCode: null,
      annualSiigoCode: null,
    });
  });
  afterAll(closeDb);

  async function newTenant(slug: string, trialDays = 30, now = d("2026-11-01T12:00:00Z")) {
    const t = await createTenant(slug);
    await withPlatform({ actorId: "t", action: "test.create_sub", tenantId: t.id }, (tx) =>
      createTrialSubscription(
        tx,
        t.id,
        {
          planId,
          period: "monthly",
          amountCents: 20_000_000n,
          vat: { enabled: true, included: false, rateBp: 1900 },
          trialDays,
        },
        now,
      ),
    );
    return t;
  }
  const sub = async (tenantId: string) =>
    (
      await systemDb()
        .select()
        .from(schema.subscription)
        .where(eq(schema.subscription.tenantId, tenantId))
    )[0];
  const tenantStatus = async (id: string) =>
    (await systemDb().select().from(schema.tenant).where(eq(schema.tenant.id, id)))[0].status;
  const events = async (tenantId: string) =>
    (
      await systemDb()
        .select()
        .from(schema.subscriptionEvent)
        .where(eq(schema.subscriptionEvent.tenantId, tenantId))
    ).map((e) => e.type);

  it("la prueba arranca con la duración del plan y deja la empresa en 'trial'", async () => {
    const t = await newTenant("sub-a", 30);
    const s = await sub(t.id);
    expect(s.status).toBe("trialing");
    expect(s.trialEndsAt?.toISOString()).toBe("2026-12-01T12:00:00.000Z");
    expect(s.priceAmountCents).toBe(20_000_000n);
    expect(await tenantStatus(t.id)).toBe("trial");
    expect(await events(t.id)).toEqual(["trial_started"]);
  });

  it("fin de trial sin método de pago → suspendida (solo lectura) y el barrido es idempotente", async () => {
    const t = await newTenant("sub-b", 10);
    const r1 = await runLifecycleSweep(noop, d("2026-11-12T00:00:00Z"));
    expect(r1.actions).toContainEqual({
      tenantId: t.id,
      action: "suspend",
      reason: "trial_expired",
    });
    expect((await sub(t.id)).status).toBe("suspended");
    expect(await tenantStatus(t.id)).toBe("suspended");
    const r2 = await runLifecycleSweep(noop, d("2026-11-12T00:00:00Z"));
    expect(r2.actions.filter((a) => a.tenantId === t.id)).toEqual([]);
  });

  it("recordatorios 7/3/1/0: se envían una sola vez cada uno", async () => {
    const sendTrialReminder = vi.fn<(s: { tenantId: string }, day: number) => Promise<void>>(
      async () => undefined,
    );
    const t = await newTenant("sub-c", 10, d("2026-11-01T15:00:00Z")); // vence 11-nov 15:00 UTC
    const h = { ...noop, sendTrialReminder };
    await runLifecycleSweep(h, d("2026-11-04T15:00:00Z")); // faltan 7 días
    await runLifecycleSweep(h, d("2026-11-04T18:00:00Z")); // mismo día: no repite
    await runLifecycleSweep(h, d("2026-11-08T15:00:00Z")); // faltan 3
    expect(
      sendTrialReminder.mock.calls.filter((c) => c[0].tenantId === t.id).map((c) => c[1]),
    ).toEqual([7, 3]);
    expect((await sub(t.id)).trialRemindersSent).toEqual([7, 3]);
  });

  it("fin de trial con método de pago → pide cobro y no cambia el estado hasta que se apruebe", async () => {
    const requestCharge = vi.fn<(s: { tenantId: string }, reason: string) => Promise<void>>(
      async () => undefined,
    );
    const t = await newTenant("sub-d", 5);
    const [src] = await systemDb()
      .insert(schema.paymentSource)
      .values({ tenantId: t.id, providerSourceId: "ps-sweep-1", type: "CARD" })
      .returning();
    await systemDb()
      .update(schema.subscription)
      .set({ defaultPaymentSourceId: src.id })
      .where(eq(schema.subscription.tenantId, t.id));
    await runLifecycleSweep({ ...noop, requestCharge }, d("2026-11-07T00:00:00Z"));
    expect(requestCharge).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: t.id }),
      "trial_end",
    );
    expect((await sub(t.id)).status).toBe("trialing");
  });

  it("pago aprobado: activa, fija el periodo y las renovaciones a tiempo continúan desde el fin anterior", async () => {
    const t = await newTenant("sub-e", 30);
    const first = await markPaid(t.id, {
      period: "monthly",
      paidAt: d("2026-11-05T12:00:00Z"),
      reference: "SUB-1",
    });
    expect(first.end.toISOString()).toBe("2026-12-05T12:00:00.000Z");
    let s = await sub(t.id);
    expect(s).toMatchObject({ status: "active", trialEndsAt: null, graceEndsAt: null });
    expect(await tenantStatus(t.id)).toBe("active");
    const second = await markPaid(t.id, {
      period: "monthly",
      paidAt: d("2026-12-04T12:00:00Z"),
      reference: "SUB-2",
    });
    expect(second.start.toISOString()).toBe("2026-12-05T12:00:00.000Z");
    expect(second.end.toISOString()).toBe("2027-01-05T12:00:00.000Z");
    s = await sub(t.id);
    expect(s.currentPeriodEnd?.toISOString()).toBe("2027-01-05T12:00:00.000Z");
  });

  it("sin pago al vencer → mora con gracia → suspendida; un pago posterior reactiva", async () => {
    const t = await newTenant("sub-f", 30);
    await markPaid(t.id, {
      period: "monthly",
      paidAt: d("2026-11-01T12:00:00Z"),
      reference: "SUB-F1",
    });
    await runLifecycleSweep(noop, d("2026-12-02T00:00:00Z")); // venció 1-dic 12:00 → mora
    let s = await sub(t.id);
    expect(s.status).toBe("past_due");
    expect(s.graceEndsAt?.toISOString()).toBe("2026-12-07T00:00:00.000Z"); // 5 días de gracia
    expect(await tenantStatus(t.id)).toBe("past_due");
    await runLifecycleSweep(noop, d("2026-12-06T00:00:00Z"));
    expect((await sub(t.id)).status).toBe("past_due");
    await runLifecycleSweep(noop, d("2026-12-07T00:00:00Z"));
    expect((await sub(t.id)).status).toBe("suspended");
    await markPaid(t.id, {
      period: "monthly",
      paidAt: d("2026-12-08T00:00:00Z"),
      reference: "SUB-F2",
    });
    s = await sub(t.id);
    expect(s.status).toBe("active");
    expect(s.currentPeriodEnd?.toISOString()).toBe("2027-01-08T00:00:00.000Z");
    expect(await events(t.id)).toEqual([
      "trial_started",
      "payment_approved",
      "payment_failed",
      "suspended",
      "payment_approved",
    ]);
  });

  it("la gracia es configurable desde la plataforma", async () => {
    await saveBillingSettings({ graceDays: 2 }, "admin");
    const t = await newTenant("sub-g", 30);
    await markPaid(t.id, {
      period: "monthly",
      paidAt: d("2026-11-01T12:00:00Z"),
      reference: "SUB-G",
    });
    await markPastDue(t.id, "test", d("2026-12-02T00:00:00Z"));
    expect((await sub(t.id)).graceEndsAt?.toISOString()).toBe("2026-12-04T00:00:00.000Z");
    await saveBillingSettings({ graceDays: 5 }, "admin");
    expect((await getBillingSettings()).graceDays).toBe(5);
  });

  it("reactivar exige un periodo vigente; extender trial y meses gratis lo habilitan", async () => {
    const t = await newTenant("sub-h", 5);
    await suspend(t.id, { reason: "manual", actorId: "admin", now: d("2026-11-10T00:00:00Z") });
    await expect(
      reactivate(t.id, { actorId: "admin", now: d("2026-11-10T00:00:00Z") }),
    ).rejects.toThrow(/No hay periodo vigente/);
    const end = await extendTrial(t.id, 10, { actorId: "admin", now: d("2026-11-10T00:00:00Z") });
    expect(end.toISOString()).toBe("2026-11-20T00:00:00.000Z");
    expect((await sub(t.id)).status).toBe("trialing");
    await suspend(t.id, { reason: "manual", actorId: "admin", now: d("2026-11-11T00:00:00Z") });
    expect(await reactivate(t.id, { actorId: "admin", now: d("2026-11-12T00:00:00Z") })).toBe(
      "trialing",
    );
    const free = await grantFreeMonths(t.id, 3, {
      actorId: "admin",
      now: d("2026-11-12T00:00:00Z"),
    });
    expect(free.toISOString()).toBe("2027-02-12T00:00:00.000Z");
    expect((await sub(t.id)).status).toBe("active");
    await expect(grantFreeMonths(t.id, 0, { actorId: "admin" })).rejects.toThrow();
    await expect(extendTrial(t.id, 400, { actorId: "admin" })).rejects.toThrow();
  });

  it("cancelar al final del periodo se ejecuta en el barrido y fija la retención; cancelar ya es inmediato", async () => {
    const t = await newTenant("sub-i", 30);
    await markPaid(t.id, {
      period: "monthly",
      paidAt: d("2026-11-01T12:00:00Z"),
      reference: "SUB-I",
    });
    await cancel(t.id, { mode: "period_end", actorId: "owner", now: d("2026-11-10T00:00:00Z") });
    expect((await sub(t.id)).status).toBe("active");
    expect((await sub(t.id)).cancelAtPeriodEnd).toBe(true);
    await runLifecycleSweep(noop, d("2026-12-01T12:00:00Z"));
    expect((await sub(t.id)).status).toBe("cancelled");
    const [row] = await systemDb().select().from(schema.tenant).where(eq(schema.tenant.id, t.id));
    expect(row.status).toBe("cancelled");
    expect(row.retentionUntil?.toISOString()).toBe("2027-03-01T12:00:00.000Z"); // +90 días (retención configurable)

    const t2 = await newTenant("sub-j", 30);
    await cancel(t2.id, { mode: "now", actorId: "owner", now: d("2026-11-10T00:00:00Z") });
    expect(await tenantStatus(t2.id)).toBe("cancelled");
    expect(await reactivate(t2.id, { actorId: "admin", now: d("2026-11-11T00:00:00Z") })).toBe(
      "trialing",
    );
    expect(
      (await systemDb().select().from(schema.tenant).where(eq(schema.tenant.id, t2.id)))[0]
        .retentionUntil,
    ).toBeNull();
  });

  it("la empresa lee su suscripción pero no puede modificarla ni ver la de otra", async () => {
    const a = await newTenant("sub-k", 30);
    const b = await newTenant("sub-l", 30);
    const own = await withTenant({ tenantId: a.id }, (tx) => tx.select().from(schema.subscription));
    expect(own.map((s) => s.tenantId)).toEqual([a.id]);
    expect(
      await dbErrorMessage(
        withTenant({ tenantId: a.id }, (tx) =>
          tx.update(schema.subscription).set({ status: "active" }),
        ),
      ),
    ).toMatch(/permission denied/);
    expect(
      await dbErrorMessage(withTenant({ tenantId: a.id }, (tx) => tx.delete(schema.subscription))),
    ).toMatch(/permission denied/);
    expect(
      await dbErrorMessage(
        withTenant({ tenantId: a.id }, (tx) =>
          tx.insert(schema.subscription).values({ tenantId: b.id, planId, status: "active" }),
        ),
      ),
    ).toMatch(/permission denied/);
  });

  it("el historial es inmutable", async () => {
    const t = await newTenant("sub-m", 30);
    expect(
      await dbErrorMessage(
        systemDb()
          .delete(schema.subscriptionEvent)
          .where(eq(schema.subscriptionEvent.tenantId, t.id)),
      ),
    ).toMatch(/solo inserción/);
  });
});
