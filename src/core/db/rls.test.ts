import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb, systemDb } from "./client";
import { withPlatform, withTenant } from "./context";
import { auditLog, integration, tenant, workCenter } from "./schema";
import { createTenant, dbErrorMessage, hasTestDb, pointToTestDb } from "./test-utils";

pointToTestDb();

describe.skipIf(!hasTestDb)("aislamiento multi-tenant (RLS)", () => {
  let a: Awaited<ReturnType<typeof createTenant>>;
  let b: Awaited<ReturnType<typeof createTenant>>;

  beforeAll(async () => {
    a = await createTenant("empresa-a");
    b = await createTenant("empresa-b");
    await withTenant({ tenantId: a.id }, (tx) =>
      tx.insert(workCenter).values({ tenantId: a.id, name: "Sede A" }),
    );
    await withTenant({ tenantId: b.id }, (tx) =>
      tx.insert(workCenter).values({ tenantId: b.id, name: "Sede B" }),
    );
  });
  afterAll(closeDb);

  it("un tenant solo lee sus propias filas", async () => {
    const rows = await withTenant({ tenantId: a.id }, (tx) => tx.select().from(workCenter));
    expect(rows.map((r) => r.name)).toEqual(["Sede A"]);
  });

  it("un tenant no puede leer filas de otro aunque filtre por su id", async () => {
    const rows = await withTenant({ tenantId: a.id }, (tx) =>
      tx.select().from(workCenter).where(eq(workCenter.tenantId, b.id)),
    );
    expect(rows).toEqual([]);
  });

  it("un tenant no puede insertar filas para otro tenant", async () => {
    await expect(
      withTenant({ tenantId: a.id }, (tx) =>
        tx.insert(workCenter).values({ tenantId: b.id, name: "Intruso" }),
      ),
    ).rejects.toThrow();
  });

  it("un tenant no puede actualizar ni borrar filas de otro", async () => {
    const upd = await withTenant({ tenantId: a.id }, (tx) =>
      tx.update(workCenter).set({ name: "hack" }).where(eq(workCenter.tenantId, b.id)).returning(),
    );
    const del = await withTenant({ tenantId: a.id }, (tx) =>
      tx.delete(workCenter).where(eq(workCenter.tenantId, b.id)).returning(),
    );
    expect(upd).toEqual([]);
    expect(del).toEqual([]);
  });

  it("un tenant solo ve su propia fila de empresa", async () => {
    const rows = await withTenant({ tenantId: a.id }, (tx) => tx.select().from(tenant));
    expect(rows.map((r) => r.slug)).toEqual(["empresa-a"]);
  });

  it("un tenant no puede cambiar su estado ni su plan", async () => {
    const msg = await dbErrorMessage(
      withTenant({ tenantId: a.id }, (tx) =>
        tx.update(tenant).set({ status: "active" }).where(eq(tenant.id, a.id)),
      ),
    );
    expect(msg).toMatch(/permission denied/);
  });

  it("un tenant no puede simular ser plataforma con un SET", async () => {
    const rows = await withTenant({ tenantId: a.id }, async (tx) => {
      await tx.execute(sql`SELECT set_config('app.is_platform', 'true', true)`);
      return tx.select().from(workCenter);
    });
    expect(rows.map((r) => r.name)).toEqual(["Sede A"]);
  });

  it("sin contexto de tenant no hay acceso a tablas de negocio", async () => {
    await expect(
      systemDb().transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL ROLE app_tenant`);
        return tx.select().from(workCenter);
      }),
    ).resolves.toEqual([]);
  });

  it("un tenant no puede leer tablas globales (integraciones)", async () => {
    const msg = await dbErrorMessage(
      withTenant({ tenantId: a.id }, (tx) => tx.select().from(integration)),
    );
    expect(msg).toMatch(/permission denied/);
  });

  it("la plataforma ve todo y queda auditada", async () => {
    const rows = await withPlatform({ actorId: "u1", action: "test.list_centers" }, (tx) =>
      tx.select().from(workCenter),
    );
    expect(rows.length).toBe(2);
    const logs = await systemDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "test.list_centers"));
    expect(logs).toHaveLength(1);
  });

  it("el audit_log es inmutable incluso para el propietario", async () => {
    expect(await dbErrorMessage(systemDb().update(auditLog).set({ action: "x" }))).toMatch(
      /solo inserción/,
    );
    expect(await dbErrorMessage(systemDb().delete(auditLog))).toMatch(/solo inserción/);
  });

  it("toda tabla con tenant_id tiene RLS habilitada y forzada (guardia para tablas nuevas)", async () => {
    const res = await systemDb().execute<{ table_name: string; rls: boolean; forced: boolean }>(sql`
      SELECT c.relname AS table_name, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relkind = 'r'
        AND (EXISTS (SELECT 1 FROM information_schema.columns col
                     WHERE col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'tenant_id')
             OR c.relname = 'tenant')
    `);
    expect(res.rows.length).toBeGreaterThan(5);
    const bad = res.rows.filter((r) => !r.rls || !r.forced).map((r) => r.table_name);
    expect(bad).toEqual([]);
  });
});
