import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, schema, systemDb, withTenant } from "@/core/db";
import {
  createTenantWithSubscription,
  dbErrorMessage,
  hasTestDb,
  pointToTestDb,
} from "@/core/db/test-utils";
import type { PaymentProvider } from "@/integrations/payments/types";
import {
  expiringSources,
  isExpiringSoon,
  listSources,
  registerPaymentSource,
  removeSource,
  setBackupSource,
  setDefaultSource,
  sourceDisplaySchema,
} from "./payment-sources";

pointToTestDb();

let counter = 100;
const provider = (fail = false): PaymentProvider & { seen: unknown[] } => ({
  name: "fake",
  seen: [],
  async getAcceptanceTokens() {
    throw new Error("n/a");
  },
  async createPaymentSource(input) {
    (this as { seen: unknown[] }).seen.push(input);
    if (fail) throw new Error("La fuente de pago ha sido declinada");
    return { providerSourceId: String(++counter), type: input.type, status: "AVAILABLE" };
  },
  async charge() {
    throw new Error("n/a");
  },
  async getTransaction() {
    throw new Error("n/a");
  },
  async verifyEvent() {
    return null;
  },
});

const reg = (tenantId: string, prov: PaymentProvider, over: Record<string, unknown> = {}) =>
  registerPaymentSource(
    {
      tenantId,
      userId: "u1",
      customerEmail: "a@b.co",
      token: "tok_test_1",
      type: "CARD",
      acceptanceToken: "a",
      personalAuthToken: "b",
      display: { brand: "VISA", last4: "4242", expMonth: 12, expYear: 29, holder: "ANA PEREZ" },
      ...over,
    },
    prov,
  );

describe("datos de visualización", () => {
  it("solo últimos 4 dígitos: rechaza números completos y normaliza años de 2 dígitos", () => {
    expect(sourceDisplaySchema.safeParse({ last4: "4242424242424242" }).success).toBe(false);
    expect(sourceDisplaySchema.safeParse({ last4: "42" }).success).toBe(false);
    expect(sourceDisplaySchema.parse({ last4: "4242", expMonth: 5, expYear: 29 })).toMatchObject({
      last4: "4242",
    });
  });
  it("vencimiento próximo: la tarjeta vence el último día del mes indicado", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    expect(isExpiringSoon({ expMonth: 11, expYear: 2026 }, now)).toBe(true);
    expect(isExpiringSoon({ expMonth: 12, expYear: 2026 }, now)).toBe(false); // vence el 31-dic: faltan 46 días
    expect(isExpiringSoon({ expMonth: 12, expYear: 2026 }, new Date("2026-12-10T00:00:00Z"))).toBe(
      true,
    );
    expect(isExpiringSoon({ expMonth: 1, expYear: 2027 }, now)).toBe(false);
    expect(isExpiringSoon({ expMonth: 10, expYear: 2026 }, now)).toBe(true); // ya vencida
    expect(isExpiringSoon({ expMonth: null, expYear: null }, now)).toBe(false);
  });
});

describe.skipIf(!hasTestDb)("métodos de pago de la empresa", () => {
  afterAll(closeDb);

  it("registra la fuente con los dos tokens de aceptación; el primero queda predeterminado; nunca se guarda un token ni datos de tarjeta", async () => {
    const t = await createTenantWithSubscription("fuentes-1");
    const prov = provider();
    const s = await reg(t.id, prov);
    expect(prov.seen[0]).toMatchObject({
      token: "tok_test_1",
      acceptanceToken: "a",
      personalAuthToken: "b",
      customerEmail: "a@b.co",
    });
    expect(s).toMatchObject({
      providerSourceId: "101",
      type: "CARD",
      brand: "VISA",
      last4: "4242",
      expMonth: 12,
      expYear: 2029,
      holder: "ANA PEREZ",
    });
    expect(JSON.stringify(s)).not.toContain("tok_test_1");
    const [sub] = await systemDb()
      .select()
      .from(schema.subscription)
      .where(eq(schema.subscription.tenantId, t.id));
    expect(sub.defaultPaymentSourceId).toBe(s.id);
    const second = await reg(t.id, prov);
    expect(
      (
        await systemDb()
          .select()
          .from(schema.subscription)
          .where(eq(schema.subscription.tenantId, t.id))
      )[0].defaultPaymentSourceId,
    ).toBe(s.id);
    expect((await listSources(t.id)).map((x) => x.id)).toEqual([s.id, second.id]);
  });

  it("si la pasarela rechaza la fuente no se guarda nada", async () => {
    const t = await createTenantWithSubscription("fuentes-2");
    await expect(reg(t.id, provider(true))).rejects.toThrow(/declinada/);
    expect(await listSources(t.id)).toEqual([]);
  });

  it("predeterminado, respaldo y eliminación mantienen la suscripción coherente", async () => {
    const t = await createTenantWithSubscription("fuentes-3");
    const prov = provider();
    const a = await reg(t.id, prov);
    const b = await reg(t.id, prov);
    const c = await reg(t.id, prov);
    const get = async () =>
      (
        await systemDb()
          .select()
          .from(schema.subscription)
          .where(eq(schema.subscription.tenantId, t.id))
      )[0];
    await setBackupSource(t.id, b.id, "u1");
    expect(await get()).toMatchObject({
      defaultPaymentSourceId: a.id,
      backupPaymentSourceId: b.id,
    });
    await expect(setBackupSource(t.id, a.id, "u1")).rejects.toThrow(/distinto/);
    await setDefaultSource(t.id, b.id, "u1"); // el respaldo pasa a predeterminado y se libera
    expect(await get()).toMatchObject({
      defaultPaymentSourceId: b.id,
      backupPaymentSourceId: null,
    });
    await setBackupSource(t.id, c.id, "u1");
    await removeSource(t.id, b.id, "u1"); // se elimina la predeterminada: la de respaldo la reemplaza
    expect(await get()).toMatchObject({
      defaultPaymentSourceId: c.id,
      backupPaymentSourceId: null,
    });
    expect((await listSources(t.id)).map((x) => x.id)).toEqual([a.id, c.id]);
    await expect(setDefaultSource(t.id, b.id, "u1")).rejects.toThrow(/no encontrado/);
  });

  it("una empresa no puede usar el método de pago de otra", async () => {
    const a = await createTenantWithSubscription("fuentes-4");
    const b = await createTenantWithSubscription("fuentes-5");
    const sa = await reg(a.id, provider());
    await expect(setDefaultSource(b.id, sa.id, "u1")).rejects.toThrow(/no encontrado/);
    await expect(removeSource(b.id, sa.id, "u1")).rejects.toThrow(/no encontrado/);
  });

  it("la empresa solo lee sus métodos de pago (RLS) y no puede escribirlos directamente", async () => {
    const a = await createTenantWithSubscription("fuentes-6");
    const b = await createTenantWithSubscription("fuentes-7");
    await reg(a.id, provider());
    await reg(b.id, provider());
    const own = await withTenant({ tenantId: a.id }, (tx) =>
      tx.select().from(schema.paymentSource),
    );
    expect(own.map((s) => s.tenantId)).toEqual([a.id]);
    expect(
      await dbErrorMessage(
        withTenant({ tenantId: a.id }, (tx) =>
          tx.update(schema.paymentSource).set({ last4: "0000" }),
        ),
      ),
    ).toMatch(/permission denied/);
    expect(
      await dbErrorMessage(withTenant({ tenantId: a.id }, (tx) => tx.delete(schema.paymentSource))),
    ).toMatch(/permission denied/);
  });

  it("detecta tarjetas por vencer", async () => {
    const t = await createTenantWithSubscription("fuentes-8");
    await reg(t.id, provider(), { display: { last4: "1111", expMonth: 12, expYear: 2026 } });
    await reg(t.id, provider(), { display: { last4: "2222", expMonth: 6, expYear: 2031 } });
    const soon = await expiringSources(new Date("2026-12-10T00:00:00Z"));
    expect(soon.filter((s) => s.tenantId === t.id).map((s) => s.last4)).toEqual(["1111"]);
  });
});
