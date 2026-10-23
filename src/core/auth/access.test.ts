import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, schema, systemDb, withTenant } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { seedTenantRoles } from "@/core/rbac/seed-roles";
import { listUserTenants, resolveTenantAccess } from "./access";

pointToTestDb();

async function makeUser(id: string, email: string, verified = true) {
  await systemDb().insert(schema.user).values({ id, name: id, email, emailVerified: verified });
}

describe.skipIf(!hasTestDb)("acceso de usuarios a una empresa", () => {
  let t: Awaited<ReturnType<typeof createTenantWithSubscription>>;
  let adminRoleId: string;
  const login = (
    userId: string,
    email: string,
    extra: Partial<Parameters<typeof resolveTenantAccess>[0]> = {},
  ) =>
    resolveTenantAccess({
      userId,
      email,
      emailVerified: true,
      tenantId: t.id,
      loginMethod: "password",
      ...extra,
    });

  beforeAll(async () => {
    t = await createTenantWithSubscription("acceso-co");
    await withTenant({ tenantId: t.id }, (tx) => seedTenantRoles(tx, t.id));
    const roles = await withTenant({ tenantId: t.id }, (tx) => tx.select().from(schema.role));
    expect(roles).toHaveLength(11);
    adminRoleId = roles.find((r) => r.systemKey === "ADMIN_EMPRESA")!.id;
  });
  afterAll(closeDb);

  it("un desconocido sin invitación ni dominio permitido no entra", async () => {
    await makeUser("u-x", "x@gmail.com");
    expect(await login("u-x", "x@gmail.com")).toEqual({ ok: false, reason: "not_invited" });
  });

  it("una invitación vigente crea la membresía con el rol invitado (solo con correo verificado)", async () => {
    await makeUser("u-inv", "inv@acme.co");
    await systemDb()
      .insert(schema.invitation)
      .values({
        tenantId: t.id,
        email: "inv@acme.co",
        roleId: adminRoleId,
        tokenHash: "h1",
        expiresAt: new Date(Date.now() + 86_400_000),
      });
    expect(await login("u-inv", "inv@acme.co", { emailVerified: false })).toEqual({
      ok: false,
      reason: "not_invited",
    });
    const r = await login("u-inv", "INV@acme.co");
    expect(r).toMatchObject({ ok: true, created: "invitation" });
    expect(await login("u-inv", "inv@acme.co")).toMatchObject({ ok: true, created: null });
  });

  it("una invitación vencida no sirve", async () => {
    await makeUser("u-old", "old@acme.co");
    await systemDb()
      .insert(schema.invitation)
      .values({
        tenantId: t.id,
        email: "old@acme.co",
        roleId: adminRoleId,
        tokenHash: "h2",
        expiresAt: new Date(Date.now() - 1000),
      });
    expect(await login("u-old", "old@acme.co")).toEqual({ ok: false, reason: "not_invited" });
  });

  it("el dominio permitido da acceso con el rol de menor privilegio", async () => {
    await systemDb()
      .update(schema.tenant)
      .set({ allowedEmailDomains: ["empresa.com"] })
      .where(eq(schema.tenant.id, t.id));
    await makeUser("u-dom", "ana@empresa.com");
    const r = await login("u-dom", "ana@empresa.com");
    expect(r).toMatchObject({ ok: true, created: "domain" });
    const [m] = await systemDb()
      .select()
      .from(schema.membership)
      .where(eq(schema.membership.userId, "u-dom"));
    const [role] = await systemDb().select().from(schema.role).where(eq(schema.role.id, m.roleId));
    expect(role.systemKey).toBe("TRABAJADOR");
    await makeUser("u-dom2", "bob@empresa.com", false);
    expect(await login("u-dom2", "bob@empresa.com", { emailVerified: false })).toEqual({
      ok: false,
      reason: "not_invited",
    });
  });

  it("solo-SSO bloquea contraseña y magic link, permite Google/Microsoft", async () => {
    await systemDb().update(schema.tenant).set({ ssoOnly: true }).where(eq(schema.tenant.id, t.id));
    expect(await login("u-dom", "ana@empresa.com", { loginMethod: "password" })).toEqual({
      ok: false,
      reason: "sso_required",
    });
    expect(await login("u-dom", "ana@empresa.com", { loginMethod: "magic_link" })).toEqual({
      ok: false,
      reason: "sso_required",
    });
    expect(await login("u-dom", "ana@empresa.com", { loginMethod: "google" })).toMatchObject({
      ok: true,
    });
    await systemDb()
      .update(schema.tenant)
      .set({ ssoOnly: false })
      .where(eq(schema.tenant.id, t.id));
  });

  it("membresías deshabilitadas o expiradas (auditor temporal) no entran", async () => {
    await makeUser("u-aud", "aud@firma.com");
    const [aud] = await systemDb()
      .select()
      .from(schema.role)
      .where(eq(schema.role.systemKey, "AUDITOR_EXTERNO"));
    await systemDb()
      .insert(schema.membership)
      .values({
        tenantId: t.id,
        userId: "u-aud",
        roleId: aud.id,
        expiresAt: new Date(Date.now() - 1000),
      });
    expect(await login("u-aud", "aud@firma.com")).toEqual({
      ok: false,
      reason: "membership_expired",
    });
    await systemDb()
      .update(schema.membership)
      .set({ expiresAt: null, status: "disabled" })
      .where(eq(schema.membership.userId, "u-aud"));
    expect(await login("u-aud", "aud@firma.com")).toEqual({
      ok: false,
      reason: "membership_disabled",
    });
  });

  it("empresas canceladas no admiten ingreso y el selector lista solo las activas del usuario", async () => {
    expect((await listUserTenants("u-dom")).map((x) => x.slug)).toEqual(["acceso-co"]);
    await systemDb()
      .update(schema.tenant)
      .set({ status: "cancelled" })
      .where(eq(schema.tenant.id, t.id));
    expect(await login("u-dom", "ana@empresa.com")).toEqual({
      ok: false,
      reason: "tenant_cancelled",
    });
  });
});
