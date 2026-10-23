import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, schema, systemDb } from "@/core/db";
import { hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { WompiProvider } from "@/integrations/payments/wompi/client";
import { eventChecksum, type WompiEvent } from "@/integrations/payments/wompi/signature";
import { saveConfig, setEnabled, setSecret } from "@/integrations/registry/service";
import { chargeSubscription } from "./charging";
import { FakeProvider, d, pays, setup, sub } from "./test-helpers";
import { handleProviderWebhook } from "./webhooks";

pointToTestDb();
const EVENTS_SECRET = "test_events_secreto_123";

function signed(
  tx: { id: string; reference: string; status: string; amount: number | bigint },
  ts = 1_800_000_000,
): { body: WompiEvent; header: string } {
  const body: WompiEvent = {
    event: "transaction.updated",
    environment: "test",
    timestamp: ts,
    data: {
      transaction: {
        id: tx.id,
        reference: tx.reference,
        status: tx.status,
        amount_in_cents: Number(tx.amount),
      },
    },
    signature: {
      properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
      checksum: "",
    },
  };
  const sum = eventChecksum(body, EVENTS_SECRET)!.toUpperCase();
  body.signature!.checksum = sum;
  return { body, header: sum };
}

describe.skipIf(!hasTestDb)("webhook de Wompi", () => {
  beforeAll(async () => {
    await saveConfig("wompi", "sandbox", { publicKey: "pub_test_1" }, "admin");
    await setSecret("wompi", "sandbox", "privateKey", "prv_test_secreto_1", { actorId: "admin" });
    await setSecret("wompi", "sandbox", "integritySecret", "test_integrity_1", {
      actorId: "admin",
    });
    await setSecret("wompi", "sandbox", "eventsSecret", EVENTS_SECRET, { actorId: "admin" });
    await setEnabled("wompi", true, "admin");
  });
  afterAll(closeDb);

  async function pending() {
    const { t } = await setup();
    await chargeSubscription(t.id, {
      reason: "trial_end",
      provider: new FakeProvider(["pending"]),
      now: d("2026-12-01T06:00:00Z"),
    });
    const [p] = await pays(t.id);
    return { t, p };
  }
  const provider = () => WompiProvider.fromRegistry();

  it("evento aprobado y firmado: activa la suscripción; reenviarlo es idempotente", async () => {
    const { t, p } = await pending();
    const { body, header } = signed({
      id: "W-1",
      reference: p.reference,
      status: "APPROVED",
      amount: p.totalCents,
    });
    const r1 = await handleProviderWebhook(provider(), body, header, {
      now: d("2026-12-01T06:05:00Z"),
    });
    expect(r1).toEqual({ status: 200, body: { ok: true } });
    expect((await sub(t.id)).status).toBe("active");
    const end = (await sub(t.id)).currentPeriodEnd;
    const r2 = await handleProviderWebhook(provider(), body, header, {
      now: d("2026-12-01T09:00:00Z"),
    });
    expect(r2).toEqual({ status: 200, body: { ok: true, message: "duplicado" } });
    expect((await sub(t.id)).currentPeriodEnd).toEqual(end);
    const stored = await systemDb().select().from(schema.webhookEvent);
    expect(stored.filter((e) => e.eventKey === header.toLowerCase())).toHaveLength(1);
    expect(stored[0].processedAt).not.toBeNull();
    expect((await pays(t.id))[0]).toMatchObject({ status: "approved", providerTxId: "W-1" });
  });

  it("firma inválida o cuerpo alterado → 401 y no se guarda ni se cambia nada", async () => {
    const { t, p } = await pending();
    const countEvents = async () => (await systemDb().select().from(schema.webhookEvent)).length;
    const before = await countEvents();
    const { body, header } = signed({
      id: "W-2",
      reference: p.reference,
      status: "DECLINED",
      amount: p.totalCents,
    });
    const forged = {
      ...body,
      data: { transaction: { ...(body.data.transaction as object), status: "APPROVED" } },
    };
    expect((await handleProviderWebhook(provider(), forged, header)).status).toBe(401);
    expect((await handleProviderWebhook(provider(), body, "0".repeat(64))).status).toBe(401);
    expect((await handleProviderWebhook(provider(), { event: "x" }, null)).status).toBe(401);
    expect((await handleProviderWebhook(provider(), "basura", null)).status).toBe(401);
    expect((await pays(t.id))[0].status).toBe("pending");
    expect(await countEvents()).toBe(before);
  });

  it("evento rechazado: registra el motivo, pone la empresa en mora y programa el reintento", async () => {
    const { t, p } = await pending();
    const { body, header } = signed(
      { id: "W-3", reference: p.reference, status: "DECLINED", amount: p.totalCents },
      1_800_000_001,
    );
    expect(
      (await handleProviderWebhook(provider(), body, header, { now: d("2026-12-01T06:10:00Z") }))
        .status,
    ).toBe(200);
    const [after] = await pays(t.id);
    expect(after).toMatchObject({ status: "declined" });
    expect(after.nextRetryAt?.toISOString()).toBe("2026-12-02T06:00:00.000Z");
    expect((await sub(t.id)).status).toBe("past_due");
  });

  it("eventos de transacciones ajenas (sin cobro propio) se aceptan y se ignoran", async () => {
    const { body, header } = signed(
      { id: "X-9", reference: "OTRA-REFERENCIA", status: "APPROVED", amount: 1000 },
      1_800_000_002,
    );
    expect((await handleProviderWebhook(provider(), body, header)).status).toBe(200);
  });

  it("monto distinto al cobrado: no aprueba y se registra el error sin provocar reintentos infinitos", async () => {
    const { t, p } = await pending();
    const { body, header } = signed(
      { id: "W-4", reference: p.reference, status: "APPROVED", amount: 100 },
      1_800_000_003,
    );
    const r = await handleProviderWebhook(provider(), body, header);
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(false);
    expect((await pays(t.id))[0].status).toBe("pending");
    expect((await sub(t.id)).status).toBe("trialing");
    const [ev] = await systemDb()
      .select()
      .from(schema.webhookEvent)
      .where(eq(schema.webhookEvent.eventKey, header.toLowerCase()));
    expect(ev.error).toMatch(/no coincide/);
  });

  it("con la integración desactivada responde 400 (la pasarela reintentará)", async () => {
    const { body, header } = signed(
      { id: "W-5", reference: "x", status: "APPROVED", amount: 1 },
      1_800_000_004,
    );
    await systemDb()
      .update(schema.integration)
      .set({ enabled: false })
      .where(eq(schema.integration.key, "wompi"));
    const { invalidateIntegrationCache } = await import("@/integrations/registry/service");
    invalidateIntegrationCache();
    const r = await handleProviderWebhook(provider(), body, header);
    expect(r.status).toBe(400);
    await setEnabled("wompi", true, "admin");
  });
});
