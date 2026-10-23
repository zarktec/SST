import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, schema, systemDb, withTenant } from "@/core/db";
import { hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { devOutbox } from "@/core/mail";
import { seedTenantRoles } from "@/core/rbac/seed-roles";
import { chargeSubscription } from "./charging";
import { registerBillingHooks } from "./hooks";
import { FakeProvider, d, setup } from "./test-helpers";

pointToTestDb();

describe.skipIf(!hasTestDb)("avisos de cobro a la empresa", () => {
  afterAll(closeDb);
  beforeAll(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    registerBillingHooks();
    registerBillingHooks(); // idempotente: no duplica los avisos
  });

  it("un cobro rechazado avisa al administrador con el motivo y la fecha del reintento; uno aprobado confirma el pago", async () => {
    const { t } = await setup();
    await withTenant({ tenantId: t.id }, (tx) => seedTenantRoles(tx, t.id));
    const [adminRole] = (
      await systemDb().select().from(schema.role).where(eq(schema.role.tenantId, t.id))
    ).filter((r) => r.systemKey === "ADMIN_EMPRESA");
    await systemDb()
      .insert(schema.user)
      .values({ id: "adm-h", name: "Admin", email: "admin@hooks.co", emailVerified: true });
    await systemDb()
      .insert(schema.membership)
      .values({ tenantId: t.id, userId: "adm-h", roleId: adminRole.id });
    devOutbox.length = 0;
    const prov = new FakeProvider(["declined", "approved"]);
    await chargeSubscription(t.id, {
      reason: "trial_end",
      provider: prov,
      now: d("2026-12-01T06:00:00Z"),
    });
    expect(devOutbox).toHaveLength(1);
    expect(devOutbox[0]).toMatchObject({
      to: "admin@hooks.co",
      subject: "No pudimos procesar tu pago",
    });
    expect(devOutbox[0].html).toContain("Fondos insuficientes");
    expect(devOutbox[0].html).toMatch(/Volveremos a intentarlo el/);
    expect(devOutbox[0].html).toContain("/facturacion");
    const { retryDueCharges } = await import("./charging");
    await retryDueCharges(prov, d("2026-12-02T06:00:00Z"));
    expect(devOutbox.map((m) => m.subject)).toEqual([
      "No pudimos procesar tu pago",
      "Recibimos tu pago",
    ]);
  });
});
