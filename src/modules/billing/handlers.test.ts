import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, schema, systemDb } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { devOutbox } from "@/core/mail";
import { seedTenantRoles } from "@/core/rbac/seed-roles";
import { withTenant } from "@/core/db";
import { eq } from "drizzle-orm";
import { adminEmails, billingHandlers } from "./handlers";

pointToTestDb();

describe.skipIf(!hasTestDb)("recordatorios de fin de prueba por correo", () => {
  let tenantId: string;
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const t = await createTenantWithSubscription("recordatorio-co");
    tenantId = t.id;
    await withTenant({ tenantId }, (tx) => seedTenantRoles(tx, tenantId));
    const roles = await systemDb()
      .select()
      .from(schema.role)
      .where(eq(schema.role.tenantId, tenantId));
    const roleOf = (k: string) => roles.find((r) => r.systemKey === k)!.id;
    for (const [id, email, role, status] of [
      ["r-admin", "admin@rec.co", "ADMIN_EMPRESA", "active"],
      ["r-admin2", "off@rec.co", "ADMIN_EMPRESA", "disabled"],
      ["r-worker", "worker@rec.co", "TRABAJADOR", "active"],
    ] as const) {
      await systemDb().insert(schema.user).values({ id, name: id, email, emailVerified: true });
      await systemDb()
        .insert(schema.membership)
        .values({ tenantId, userId: id, roleId: roleOf(role), status });
    }
  });
  afterAll(closeDb);

  it("solo los administradores activos reciben avisos de facturación", async () => {
    expect(await adminEmails(tenantId)).toEqual(["admin@rec.co"]);
  });

  it("el recordatorio dice cuándo vence y enlaza a Facturación", async () => {
    devOutbox.length = 0;
    const [sub] = await systemDb()
      .select()
      .from(schema.subscription)
      .where(eq(schema.subscription.tenantId, tenantId));
    await billingHandlers().sendTrialReminder(sub, 3);
    await billingHandlers().sendTrialReminder(sub, 0);
    expect(devOutbox.map((m) => [m.to, m.subject])).toEqual([
      ["admin@rec.co", "Tu prueba gratuita termina en 3 días"],
      ["admin@rec.co", "Tu prueba gratuita termina hoy"],
    ]);
    expect(devOutbox[0].html).toContain("/facturacion");
  });
});
