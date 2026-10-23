import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, schema, systemDb, withPlatform } from "@/core/db";
import { hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import type { ProviderTransaction } from "@/integrations/payments/types";
import {
  applyTransaction,
  chargeSubscription,
  paymentHooks,
  referenceFor,
  retryDueCharges,
} from "./charging";
import { runLifecycleSweep } from "./subscriptions";
import { FakeProvider, d, lastSetupIndex, pays, setup, sub } from "./test-helpers";

pointToTestDb();

describe.skipIf(!hasTestDb)("cobro de suscripciones (Wompi simulado)", () => {
  afterAll(closeDb);
  const onApproved = vi.fn(async () => undefined);
  const onFailed = vi.fn(async () => undefined);
  beforeEach(() => {
    paymentHooks.onApproved = [onApproved];
    paymentHooks.onFailed = [onFailed];
    onApproved.mockClear();
    onFailed.mockClear();
  });

  it("fin de trial con método de pago: cobra el plan elegido (IVA 19 %), activa y deja la referencia idempotente", async () => {
    const { t } = await setup();
    const prov = new FakeProvider(["approved"]);
    const r = await chargeSubscription(t.id, {
      reason: "trial_end",
      provider: prov,
      now: d("2026-12-01T06:00:00Z"),
    });
    expect(r.kind).toBe("charged");
    const s = await sub(t.id);
    expect(prov.calls).toHaveLength(1);
    expect(prov.calls[0]).toMatchObject({ amountCents: 23_800_000n, recurrent: true });
    expect(prov.calls[0].reference).toBe(referenceFor(s.id, "2026-12-01", 1));
    expect(prov.calls[0].reference).toBe(`SUB-${s.id}-20261201`);
    expect(s).toMatchObject({ status: "active", scheduledPlanId: null, trialEndsAt: null });
    expect(s.priceAmountCents).toBe(20_000_000n);
    expect(s.currentPeriodEnd?.toISOString()).toBe("2027-01-01T06:00:00.000Z");
    const [p] = await pays(t.id);
    expect(p).toMatchObject({
      status: "approved",
      netCents: 20_000_000n,
      vatCents: 3_800_000n,
      totalCents: 23_800_000n,
      sourceRole: "default",
      attempt: 1,
    });
    expect(onApproved).toHaveBeenCalledTimes(1);
    // Repetir el barrido el mismo día no vuelve a cobrar
    const again = await chargeSubscription(t.id, {
      reason: "trial_end",
      provider: prov,
      now: d("2026-12-01T07:00:00Z"),
    });
    expect(again).toEqual({ kind: "skipped", reason: "not_due" }); // el ciclo siguiente aún no vence
    expect(prov.calls).toHaveLength(1);
  });

  it("transacción pendiente: espera el webhook; el evento aprobado activa y repetirlo no extiende el periodo dos veces", async () => {
    const { t } = await setup();
    const prov = new FakeProvider(["pending"]);
    const r = await chargeSubscription(t.id, {
      reason: "trial_end",
      provider: prov,
      now: d("2026-12-01T06:00:00Z"),
    });
    expect(r.kind === "charged" && r.payment.status).toBe("pending");
    expect((await sub(t.id)).status).toBe("trialing");
    expect(
      await chargeSubscription(t.id, {
        reason: "trial_end",
        provider: prov,
        now: d("2026-12-01T06:01:00Z"),
      }),
    ).toEqual({ kind: "skipped", reason: "pending" });
    const [p] = await pays(t.id);
    const tx: ProviderTransaction = {
      providerTxId: "T-1",
      reference: p.reference,
      status: "approved",
      amountCents: p.totalCents,
    };
    await applyTransaction(p.id, tx, { now: d("2026-12-01T06:05:00Z") });
    await applyTransaction(p.id, tx, { now: d("2026-12-01T06:06:00Z") });
    await applyTransaction(p.id, { ...tx, status: "pending" }, { now: d("2026-12-01T06:07:00Z") }); // evento viejo fuera de orden
    const s = await sub(t.id);
    expect(s.status).toBe("active");
    expect(s.currentPeriodEnd?.toISOString()).toBe("2027-01-01T06:05:00.000Z");
    expect((await pays(t.id))[0].status).toBe("approved");
    expect(onApproved).toHaveBeenCalledTimes(1);
  });

  it("dos barridos simultáneos solo cobran una vez", async () => {
    const { t } = await setup();
    const prov = new FakeProvider(["pending", "pending"]);
    await Promise.all(
      [1, 2, 3].map(() =>
        chargeSubscription(t.id, {
          reason: "trial_end",
          provider: prov,
          now: d("2026-12-01T06:00:00Z"),
        }),
      ),
    );
    expect(prov.calls).toHaveLength(1);
    expect(await pays(t.id)).toHaveLength(1);
  });

  it("rechazo: mora con gracia, reintentos días 1, 3 y 5 con referencias nuevas y luego el método de respaldo", async () => {
    const { t, bak } = await setup({ backup: true });
    const prov = new FakeProvider(["declined", "declined", "declined", "declined", "approved"]);
    const day = (n: number) => d(`2026-12-0${1 + n}T06:00:00Z`);
    const first = await chargeSubscription(t.id, {
      reason: "trial_end",
      provider: prov,
      now: day(0),
    });
    expect(first.kind === "charged" && first.payment).toMatchObject({
      status: "declined",
      declineReason: "Fondos insuficientes",
      attempt: 1,
    });
    let s = await sub(t.id);
    expect(s.status).toBe("past_due");
    expect(s.graceEndsAt?.toISOString()).toBe("2026-12-06T06:00:00.000Z");
    expect(onFailed).toHaveBeenCalledTimes(1);

    // Antes del día 1 no se reintenta
    expect(await retryDueCharges(prov, d("2026-12-01T20:00:00Z"))).toEqual([]);
    expect(await retryDueCharges(prov, day(1))).toEqual([{ tenantId: t.id, outcome: "declined" }]); // día 1
    expect(await retryDueCharges(prov, day(1))).toEqual([]); // ya no está vencido
    expect(await retryDueCharges(prov, day(3))).toEqual([{ tenantId: t.id, outcome: "declined" }]); // día 3
    expect(await retryDueCharges(prov, day(5))).toEqual([{ tenantId: t.id, outcome: "declined" }]); // día 5 → último de la fuente predeterminada
    const afterDefault = await pays(t.id);
    expect(afterDefault.map((p) => [p.attempt, p.sourceRole])).toEqual([
      [1, "default"],
      [2, "default"],
      [3, "default"],
      [4, "default"],
    ]);
    expect(afterDefault.map((p) => p.reference)).toEqual([
      referenceFor(s.id, "2026-12-01", 1),
      `${referenceFor(s.id, "2026-12-01", 1)}-R2`,
      `${referenceFor(s.id, "2026-12-01", 1)}-R3`,
      `${referenceFor(s.id, "2026-12-01", 1)}-R4`,
    ]);
    // Agotada la predeterminada → intenta con el respaldo (inmediato)
    expect(await retryDueCharges(prov, day(5))).toEqual([{ tenantId: t.id, outcome: "approved" }]);
    const all = await pays(t.id);
    expect(all.at(-1)).toMatchObject({
      attempt: 5,
      sourceRole: "backup",
      status: "approved",
      paymentSourceId: bak!.id,
    });
    s = await sub(t.id);
    expect(s).toMatchObject({ status: "active", graceEndsAt: null });
    expect(prov.calls[4].providerSourceId).toBe("ps-" + lastSetupIndex() + "-2");
    expect(onApproved).toHaveBeenCalledTimes(1);
  });

  it("sin respaldo: tras los reintentos queda en mora y al vencer la gracia se suspende; 'Pagar ahora' la reactiva", async () => {
    const { t } = await setup();
    const prov = new FakeProvider(["declined", "declined", "declined", "declined", "approved"]);
    await chargeSubscription(t.id, {
      reason: "trial_end",
      provider: prov,
      now: d("2026-12-01T06:00:00Z"),
    });
    for (const day of [2, 4, 6]) await retryDueCharges(prov, d(`2026-12-0${day}T06:00:00Z`));
    expect((await pays(t.id)).at(-1)).toMatchObject({
      attempt: 4,
      status: "declined",
      nextRetryAt: null,
    });
    expect(onFailed).toHaveBeenLastCalledWith(expect.anything(), {
      willRetryAt: null,
      exhausted: true,
    });
    expect(
      await chargeSubscription(t.id, {
        reason: "retry",
        provider: prov,
        now: d("2026-12-07T06:00:00Z"),
      }),
    ).toEqual({ kind: "skipped", reason: "attempts_exhausted" });
    await runLifecycleSweep(
      { requestCharge: async () => undefined, sendTrialReminder: async () => undefined },
      d("2026-12-07T00:00:00Z"),
    );
    expect((await sub(t.id)).status).toBe("suspended");
    // El administrador paga a mano: nuevo intento con la misma fuente
    const manual = await chargeSubscription(t.id, {
      reason: "manual",
      provider: prov,
      now: d("2026-12-08T10:00:00Z"),
    });
    expect(manual.kind === "charged" && manual.payment).toMatchObject({
      attempt: 5,
      sourceRole: "manual",
      status: "approved",
    });
    expect(await sub(t.id)).toMatchObject({ status: "active" });
  });

  it("error de red cuenta como intento fallido y se reintenta con otra referencia", async () => {
    const { t } = await setup();
    const prov = new FakeProvider(["throw", "approved"]);
    const r = await chargeSubscription(t.id, {
      reason: "trial_end",
      provider: prov,
      now: d("2026-12-01T06:00:00Z"),
    });
    expect(r.kind === "charged" && r.payment).toMatchObject({
      status: "error",
      declineReason: "timeout",
    });
    await retryDueCharges(prov, d("2026-12-02T06:00:00Z"));
    expect((await pays(t.id)).map((p) => p.status)).toEqual(["error", "approved"]);
    expect(prov.calls[1].reference).toMatch(/-R2$/);
  });

  it("un evento con monto distinto al cobro no aprueba nada", async () => {
    const { t } = await setup();
    const prov = new FakeProvider(["pending"]);
    await chargeSubscription(t.id, {
      reason: "trial_end",
      provider: prov,
      now: d("2026-12-01T06:00:00Z"),
    });
    const [p] = await pays(t.id);
    await expect(
      applyTransaction(p.id, {
        providerTxId: "T",
        reference: p.reference,
        status: "approved",
        amountCents: 100n,
      }),
    ).rejects.toThrow(/no coincide/);
    expect((await pays(t.id))[0].status).toBe("pending");
    expect((await sub(t.id)).status).toBe("trialing");
  });

  it("doble aprobación en el mismo ciclo: un solo periodo y el segundo cobro queda marcado para reembolso", async () => {
    const { t } = await setup();
    const prov = new FakeProvider(["throw", "approved"]);
    await chargeSubscription(t.id, {
      reason: "trial_end",
      provider: prov,
      now: d("2026-12-01T06:00:00Z"),
    });
    await retryDueCharges(prov, d("2026-12-02T06:00:00Z")); // el R2 se aprueba
    const [first, second] = await pays(t.id);
    // Llega tarde el webhook del primer intento ("error" por timeout) diciendo que SÍ se aprobó
    // (los estados finales no se reabren: el intento 1 queda 'error'; se registra solo si fuera pending)
    expect(first.status).toBe("error");
    expect(second.status).toBe("approved");
    const s = await sub(t.id);
    expect(s.currentPeriodEnd?.toISOString()).toBe("2027-01-02T06:00:00.000Z");
    expect(onApproved).toHaveBeenCalledTimes(1);
  });

  it("cobro dos veces aprobado (pendiente + otro aprobado): no extiende dos veces y avisa 'duplicate_charge'", async () => {
    const { t } = await setup();
    const prov = new FakeProvider(["pending", "pending"]);
    await chargeSubscription(t.id, {
      reason: "trial_end",
      provider: prov,
      now: d("2026-12-01T06:00:00Z"),
    });
    const [p1] = await pays(t.id);
    // Se fuerza un segundo cobro pendiente del mismo ciclo (p. ej. reintento manual mientras llegaba el webhook)
    await withPlatform({ actorId: "t", action: "t", tenantId: t.id, audit: false }, (tx) =>
      tx.insert(schema.payment).values({
        tenantId: t.id,
        subscriptionId: p1.subscriptionId,
        planId: p1.planId,
        period: "monthly",
        periodKey: p1.periodKey,
        attempt: 2,
        sourceRole: "manual",
        reference: `${p1.reference}-R2`,
        status: "pending",
        netCents: p1.netCents,
        vatCents: p1.vatCents,
        totalCents: p1.totalCents,
      }),
    );
    const [, p2] = await pays(t.id);
    await applyTransaction(
      p1.id,
      {
        providerTxId: "A",
        reference: p1.reference,
        status: "approved",
        amountCents: p1.totalCents,
      },
      { now: d("2026-12-01T06:10:00Z") },
    );
    await applyTransaction(
      p2.id,
      {
        providerTxId: "B",
        reference: p2.reference,
        status: "approved",
        amountCents: p2.totalCents,
      },
      { now: d("2026-12-01T06:20:00Z") },
    );
    const s = await sub(t.id);
    expect(s.currentPeriodEnd?.toISOString()).toBe("2027-01-01T06:10:00.000Z"); // una sola extensión
    const dup = await systemDb()
      .select()
      .from(schema.subscriptionEvent)
      .where(eq(schema.subscriptionEvent.subscriptionId, s.id));
    expect(dup.map((e) => e.type)).toContain("duplicate_charge");
    expect((await pays(t.id))[1].providerPayload).toMatchObject({ refundRequired: true });
    expect(onApproved).toHaveBeenCalledTimes(1);
  });

  it("cupón del 10 %: solo rebaja el primer pago y se consume", async () => {
    const { t } = await setup({ coupon: true });
    const prov = new FakeProvider(["approved", "approved"]);
    await chargeSubscription(t.id, {
      reason: "trial_end",
      provider: prov,
      now: d("2026-12-01T06:00:00Z"),
    });
    expect(prov.calls[0].amountCents).toBe(21_420_000n); // 200.000 − 10 % = 180.000 + IVA 19 %
    expect((await sub(t.id)).couponId).toBeNull();
    await chargeSubscription(t.id, {
      reason: "renewal",
      provider: prov,
      now: d("2027-01-01T07:00:00Z"),
    });
    expect(prov.calls[1].amountCents).toBe(23_800_000n); // el segundo mes ya paga completo
  });

  it("cupón del 100 %: se aprueba sin llamar a la pasarela", async () => {
    const { t } = await setup({ coupon: true });
    await systemDb()
      .update(schema.subscription)
      .set({ couponValue: 10000n })
      .where(eq(schema.subscription.tenantId, t.id));
    const prov = new FakeProvider();
    const r = await chargeSubscription(t.id, {
      reason: "trial_end",
      provider: prov,
      now: d("2026-12-01T06:00:00Z"),
    });
    expect(prov.calls).toHaveLength(0);
    expect(r.kind === "charged" && r.payment).toMatchObject({
      status: "approved",
      totalCents: 0n,
      discountCents: 20_000_000n,
    });
    expect(await sub(t.id)).toMatchObject({ status: "active" });
  });

  it("sin plan elegido, sin método de pago o suscripción cancelada: no cobra", async () => {
    const a = await setup({ plan: false });
    const prov = new FakeProvider();
    expect(
      await chargeSubscription(a.t.id, {
        reason: "trial_end",
        provider: prov,
        now: d("2026-12-02T00:00:00Z"),
      }),
    ).toEqual({ kind: "skipped", reason: "no_plan_selected" });
    const b = await setup({ defaultSource: false });
    expect(
      await chargeSubscription(b.t.id, {
        reason: "trial_end",
        provider: prov,
        now: d("2026-12-02T00:00:00Z"),
      }),
    ).toEqual({ kind: "skipped", reason: "no_source" });
    const c = await setup();
    await systemDb()
      .update(schema.subscription)
      .set({ status: "cancelled" })
      .where(eq(schema.subscription.tenantId, c.t.id));
    expect(await chargeSubscription(c.t.id, { reason: "renewal", provider: prov })).toEqual({
      kind: "skipped",
      reason: "not_billable",
    });
    expect(prov.calls).toHaveLength(0);
  });

  it("un cambio de precio del plan aplica en la renovación (no antes)", async () => {
    const { t, planId } = await setup();
    const prov = new FakeProvider(["approved", "approved"]);
    await chargeSubscription(t.id, {
      reason: "trial_end",
      provider: prov,
      now: d("2026-12-01T06:00:00Z"),
    });
    await systemDb()
      .update(schema.planPrice)
      .set({ amountCents: 30_000_000n })
      .where(eq(schema.planPrice.planId, planId));
    expect((await sub(t.id)).priceAmountCents).toBe(20_000_000n); // la suscripción conserva su precio hasta renovar
    await chargeSubscription(t.id, {
      reason: "renewal",
      provider: prov,
      now: d("2027-01-01T07:00:00Z"),
    });
    expect(prov.calls[1].amountCents).toBe(35_700_000n); // nuevo precio + IVA
    expect((await sub(t.id)).priceAmountCents).toBe(30_000_000n);
  });
});
