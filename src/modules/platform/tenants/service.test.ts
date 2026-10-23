import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resolveTenantAccess } from "@/core/auth/access";
import { closeDb, schema, systemDb } from "@/core/db";
import { hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import type { DomainProvider, DomainState } from "@/integrations/vercel-domains";
import { createPlan, seedPlans, updatePlan, getPlanByKey } from "@/modules/platform/plans/service";
import {
  createTenantWithTrial,
  getTenantDetail,
  isSlugAvailable,
  listTenants,
  requestCustomDomain,
  syncDomains,
  TenantError,
  validateCustomHost,
} from "./service";

pointToTestDb();

class FakeDomains implements DomainProvider {
  calls: string[] = [];
  constructor(private state: Partial<DomainState> = {}) {}
  set(s: Partial<DomainState>) {
    this.state = s;
  }
  async add(host: string) {
    this.calls.push(`add:${host}`);
    return { host, verified: true, configured: true, instructions: [], ...this.state };
  }
  async check(host: string) {
    this.calls.push(`check:${host}`);
    return { host, verified: true, configured: true, instructions: [], ...this.state };
  }
  async remove() {}
}

describe("validación de dominios propios", () => {
  it("acepta FQDN válidos", () =>
    expect(validateCustomHost("SST.MiEmpresa.com")).toBe("sst.miempresa.com"));
  it.each(["localhost", "no es dominio", "a..com", "x.c", "-a.com"])("rechaza %s", (h) =>
    expect(() => validateCustomHost(h)).toThrow(),
  );
  it("no permite dominios de la propia plataforma", () => {
    expect(() => validateCustomHost("acme.sst.zark.pro", "sst.zark.pro")).toThrow(/plataforma/);
    expect(() => validateCustomHost("sst.zark.pro", "sst.zark.pro")).toThrow(/plataforma/);
  });
});

describe.skipIf(!hasTestDb)("empresas: creación, listado y dominios", () => {
  beforeAll(async () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "sst.test";
    await systemDb().delete(schema.planPrice);
    await systemDb().delete(schema.plan);
    await seedPlans();
  });
  afterAll(closeDb);

  it("crea la empresa con roles, marca, subdominio y prueba según el plan (duración configurable)", async () => {
    const trial = (await getPlanByKey("free-trial"))!;
    await updatePlan(trial.id, {
      ...{
        key: "free-trial",
        name: "Free Trial",
        description: "",
        isTrial: true,
        trialDays: 45,
        vatEnabled: false,
        vatIncluded: false,
        vatRatePercent: 0,
        limits: { workers: null, users: null, centers: null, storageMb: null },
        modules: trial.modules,
        visible: false,
        sortOrder: 0,
        active: true,
        monthlyPesos: null,
        annualPesos: null,
        monthlySiigoCode: null,
        annualSiigoCode: null,
      },
    });
    const fake = new FakeDomains();
    const now = new Date("2026-11-01T10:00:00Z");
    const r = await createTenantWithTrial(
      {
        slug: "Acme-Sas",
        legalName: "Acme S.A.S.",
        tradeName: "Acme",
        nit: "900111222",
        owner: { email: "Gerente@Acme.co" },
      },
      "admin",
      { domains: fake, now },
    );
    expect(r).toMatchObject({ host: "acme-sas.sst.test", domainStatus: "verified" });
    expect(fake.calls).toEqual(["add:acme-sas.sst.test"]);

    const d = (await getTenantDetail(r.tenantId))!;
    expect(d.tenant).toMatchObject({ slug: "acme-sas", status: "trial", nit: "900111222" });
    expect(d.subscription).toMatchObject({ status: "trialing" });
    expect(d.subscription?.trialEndsAt?.toISOString()).toBe("2026-12-16T10:00:00.000Z"); // 45 días
    expect(d.domains).toEqual([
      expect.objectContaining({ host: "acme-sas.sst.test", status: "verified", kind: "subdomain" }),
    ]);
    const roles = await systemDb()
      .select()
      .from(schema.role)
      .where(eq(schema.role.tenantId, r.tenantId));
    expect(roles).toHaveLength(11);
    const [branding] = await systemDb()
      .select()
      .from(schema.tenantBranding)
      .where(eq(schema.tenantBranding.tenantId, r.tenantId));
    expect(branding).toBeTruthy();
    // El dueño se invita por correo: entra con magic link y obtiene el rol ADMIN_EMPRESA
    await systemDb()
      .insert(schema.user)
      .values({ id: "owner-acme", name: "Gerente", email: "gerente@acme.co", emailVerified: true });
    const access = await resolveTenantAccess({
      userId: "owner-acme",
      email: "gerente@acme.co",
      emailVerified: true,
      tenantId: r.tenantId,
      loginMethod: "magic_link",
    });
    expect(access).toMatchObject({ ok: true, created: "invitation" });
  });

  it("subdominio duplicado, reservado o inválido no se crea (y no deja basura)", async () => {
    const fake = new FakeDomains();
    await createTenantWithTrial(
      { slug: "dup-co", legalName: "Dup", tradeName: "Dup", owner: { email: "a@dup.co" } },
      "admin",
      { domains: fake },
    );
    await expect(
      createTenantWithTrial(
        { slug: "dup-co", legalName: "Dup 2", tradeName: "Dup 2", owner: { email: "b@dup.co" } },
        "admin",
        { domains: fake },
      ),
    ).rejects.toBeInstanceOf(TenantError);
    for (const slug of ["admin", "auth", "www", "a", "-x", "con espacio"]) {
      await expect(
        createTenantWithTrial(
          { slug, legalName: "X X", tradeName: "X X", owner: { email: "x@x.co" } },
          "admin",
          { domains: fake },
        ),
      ).rejects.toThrow();
    }
    expect(await isSlugAvailable("dup-co")).toBe(false);
    expect(await isSlugAvailable("libre-co")).toBe(true);
    expect(await isSlugAvailable("admin")).toBe(false);
    const dups = await systemDb()
      .select()
      .from(schema.tenant)
      .where(eq(schema.tenant.slug, "dup-co"));
    expect(dups).toHaveLength(1);
  });

  it("si Vercel falla la empresa se crea igual y el dominio queda en error para reintento", async () => {
    const fake = new FakeDomains({ verified: false, configured: false, error: "Vercel caído" });
    const r = await createTenantWithTrial(
      { slug: "vercel-down", legalName: "V D", tradeName: "VD", owner: { email: "v@vd.co" } },
      "admin",
      { domains: fake },
    );
    expect(r.domainStatus).toBe("error");
    const [dom] = await systemDb()
      .select()
      .from(schema.tenantDomain)
      .where(eq(schema.tenantDomain.tenantId, r.tenantId));
    expect(dom).toMatchObject({ status: "error", lastError: "Vercel caído" });
    fake.set({});
    const sync = await syncDomains(fake);
    expect(sync.changed).toBeGreaterThanOrEqual(1);
    const [after] = await systemDb()
      .select()
      .from(schema.tenantDomain)
      .where(eq(schema.tenantDomain.tenantId, r.tenantId));
    expect(after.status).toBe("verified");
    expect(after.lastError).toBeNull();
  });

  it("dominio propio: queda pendiente con instrucciones DNS y pasa a verificado al configurarse", async () => {
    const r = await createTenantWithTrial(
      { slug: "propio-co", legalName: "P C", tradeName: "PC", owner: { email: "p@pc.co" } },
      "admin",
      { domains: new FakeDomains() },
    );
    const fake = new FakeDomains({
      verified: true,
      configured: false,
      instructions: [{ type: "CNAME", name: "sst", value: "cname.vercel-dns.com" }],
    });
    const st = await requestCustomDomain(r.tenantId, "SST.propio.com", "owner", fake);
    expect(st.instructions).toEqual([
      { type: "CNAME", name: "sst", value: "cname.vercel-dns.com" },
    ]);
    let [dom] = await systemDb()
      .select()
      .from(schema.tenantDomain)
      .where(eq(schema.tenantDomain.host, "sst.propio.com"));
    expect(dom).toMatchObject({ status: "pending", kind: "custom" });
    expect(dom.dnsRecords).toEqual([{ type: "CNAME", name: "sst", value: "cname.vercel-dns.com" }]);
    await expect(requestCustomDomain(r.tenantId, "sst.propio.com", "owner", fake)).rejects.toThrow(
      /ya está registrado/,
    );
    fake.set({ verified: true, configured: true });
    await syncDomains(fake);
    [dom] = await systemDb()
      .select()
      .from(schema.tenantDomain)
      .where(eq(schema.tenantDomain.host, "sst.propio.com"));
    expect(dom.status).toBe("verified");
  });

  it("listado con búsqueda, filtro por estado/plan y paginación", async () => {
    const all = await listTenants({ pageSize: 100 });
    expect(all.total).toBeGreaterThanOrEqual(4);
    expect((await listTenants({ search: "acme" })).rows.map((r) => r.slug)).toEqual(["acme-sas"]);
    expect((await listTenants({ search: "900111222" })).rows).toHaveLength(1);
    expect((await listTenants({ status: "suspended" })).total).toBe(0);
    const trial = (await getPlanByKey("free-trial"))!;
    expect((await listTenants({ planId: trial.id, pageSize: 100 })).total).toBe(all.total);
    const p1 = await listTenants({ pageSize: 2, page: 1 });
    const p2 = await listTenants({ pageSize: 2, page: 2 });
    expect(p1.rows).toHaveLength(2);
    expect(p1.rows.map((r) => r.id)).not.toEqual(p2.rows.map((r) => r.id));
    expect(p1.rows[0]).toMatchObject({ planName: "Free Trial", status: "trial" });
  });

  it("el límite de usuarios del plan se aplica al aceptar invitaciones", async () => {
    const plan = await createPlan({
      key: "dos-usuarios",
      name: "Dos",
      description: "",
      isTrial: false,
      trialDays: null,
      vatEnabled: false,
      vatIncluded: false,
      vatRatePercent: 0,
      limits: { workers: null, users: 1, centers: null, storageMb: null },
      modules: [],
      visible: false,
      sortOrder: 0,
      active: true,
      monthlyPesos: 1000,
      annualPesos: null,
      monthlySiigoCode: null,
      annualSiigoCode: null,
    });
    const r = await createTenantWithTrial(
      {
        slug: "limite-co",
        legalName: "L C",
        tradeName: "LC",
        planId: plan,
        owner: { email: "uno@lc.co" },
      },
      "admin",
      { domains: new FakeDomains() },
    );
    for (const [id, email] of [
      ["lc1", "uno@lc.co"],
      ["lc2", "dos@lc.co"],
    ] as const) {
      await systemDb().insert(schema.user).values({ id, name: id, email, emailVerified: true });
    }
    const [adminRole] = await systemDb()
      .select()
      .from(schema.role)
      .where(eq(schema.role.tenantId, r.tenantId));
    await systemDb()
      .insert(schema.invitation)
      .values({
        tenantId: r.tenantId,
        email: "dos@lc.co",
        roleId: adminRole.id,
        tokenHash: "lc-2",
        expiresAt: new Date(Date.now() + 86_400_000),
      });
    const first = await resolveTenantAccess({
      userId: "lc1",
      email: "uno@lc.co",
      emailVerified: true,
      tenantId: r.tenantId,
      loginMethod: "magic_link",
    });
    expect(first).toMatchObject({ ok: true });
    const second = await resolveTenantAccess({
      userId: "lc2",
      email: "dos@lc.co",
      emailVerified: true,
      tenantId: r.tenantId,
      loginMethod: "magic_link",
    });
    expect(second).toEqual({ ok: false, reason: "plan_limit" });
  });
});
