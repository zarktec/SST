import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, schema, systemDb } from "@/core/db";
import { hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import {
  getPortalOverview,
  payNow,
  paymentsCsv,
  requestCancellation,
  selectPlan,
  undoCancellation,
} from "./portal";
import { FakeProvider, setup, sub } from "./test-helpers";

pointToTestDb();

describe.skipIf(!hasTestDb)("portal de facturación", () => {
  afterAll(closeDb);
  beforeAll(() => vi.spyOn(console, "info").mockImplementation(() => undefined));

  it("resumen: plan, próximo cobro con IVA y métodos de pago", async () => {
    const { t } = await setup();
    const o = await getPortalOverview(t.id);
    expect(o?.nextCharge).toMatchObject({
      netCents: 20_000_000n,
      vatCents: 3_800_000n,
      totalCents: 23_800_000n,
    });
    expect(o?.sources).toHaveLength(1);
  });

  it("elegir plan: valida precio y programa el cambio", async () => {
    const { t, planId } = await setup({ plan: false });
    await selectPlan(t.id, "u", { planId, period: "monthly" });
    expect((await sub(t.id)).scheduledPlanId).toBe(planId);
    await expect(selectPlan(t.id, "u", { planId, period: "annual" })).rejects.toThrow(
      /periodicidad/,
    );
    await expect(
      selectPlan(t.id, "u", { planId: "00000000-0000-7000-8000-000000000000", period: "monthly" }),
    ).rejects.toThrow(/no disponible/);
  });

  it("Pagar ahora en prueba cobra y activa; cancelar programa y se puede deshacer", async () => {
    const { t } = await setup();
    const out = await payNow(t.id, new FakeProvider(["approved"]));
    expect(out.kind).toBe("charged");
    expect((await sub(t.id)).status).toBe("active");
    await requestCancellation(t.id, "u");
    expect((await sub(t.id)).cancelAtPeriodEnd).toBe(true);
    await undoCancellation(t.id, "u");
    expect((await sub(t.id)).cancelAtPeriodEnd).toBe(false);
  });

  it("cancelar en prueba termina de inmediato; el CSV lista los pagos con BOM", async () => {
    const { t } = await setup();
    await payNow(t.id, new FakeProvider(["approved"]));
    const csv = await paymentsCsv(t.id);
    expect(csv.startsWith('﻿"Fecha"')).toBe(true);
    expect(csv.split("\r\n")).toHaveLength(2);
    expect(csv).toContain("238000.00");
    const b = await setup();
    await requestCancellation(b.t.id, "u");
    expect((await sub(b.t.id)).status).toBe("cancelled");
    expect(
      await systemDb()
        .select()
        .from(schema.subscription)
        .where(eq(schema.subscription.tenantId, b.t.id)),
    ).toHaveLength(1);
  });
});
