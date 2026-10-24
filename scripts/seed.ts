import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { closeDb, schema, systemDb, withPlatform, withTenant } from "../src/core/db";
import { seedTenantRoles } from "../src/core/rbac/seed-roles";
import { ensureIntegrations } from "../src/integrations/registry/service";
import { seedHolidays } from "../src/core/calendar/service";
import { seedCatalogs } from "../src/modules/platform/catalogs/service";
import { createTrialSubscription } from "../src/modules/billing/subscriptions";
import { getTrialPlan, seedPlans } from "../src/modules/platform/plans/service";
import { uuidv7 } from "../src/lib/uuid";

/** Seed idempotente: SUPER ADMIN inicial (variables de entorno), integraciones y empresa demo. */
export async function seed() {
  const db = systemDb();
  await ensureIntegrations();
  await seedPlans();
  await seedHolidays([2026, 2027, 2028, 2029, 2030]);
  await seedCatalogs();

  const email = process.env.SUPER_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (email && password) {
    let [u] = await db.select().from(schema.user).where(eq(schema.user.email, email));
    if (!u) {
      const id = uuidv7();
      [u] = await db
        .insert(schema.user)
        .values({ id, name: "Super Admin", email, emailVerified: true })
        .returning();
      await db.insert(schema.account).values({
        id: uuidv7(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: await hashPassword(password),
      });
    }
    await db
      .insert(schema.platformStaff)
      .values({ userId: u.id, role: "SUPER_ADMIN" })
      .onConflictDoNothing();
    console.log(`SUPER_ADMIN listo: ${email} (activa 2FA en el primer ingreso)`);
  } else {
    console.warn("SUPER_ADMIN_EMAIL/SUPER_ADMIN_PASSWORD no definidos: se omite el SUPER ADMIN");
  }

  // La empresa demo (y su usuario) solo existen fuera de producción.
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") return;
  const [demo] = await db
    .insert(schema.tenant)
    .values({
      slug: "demo",
      legalName: "Empresa Demo S.A.S.",
      tradeName: "Empresa Demo",
      nit: "900123456",
      nitDv: "1",
    })
    .onConflictDoNothing()
    .returning();
  const [demoTenant] = demo
    ? [demo]
    : await db.select().from(schema.tenant).where(eq(schema.tenant.slug, "demo"));
  const trial = await getTrialPlan();
  if (demoTenant && trial) {
    // Suscripción de prueba de la empresa demo (idempotente).
    await withPlatform(
      { actorId: "seed", action: "seed.demo.subscription", tenantId: demoTenant.id, audit: false },
      async (tx) => {
        const has = await tx
          .select({ id: schema.subscription.id })
          .from(schema.subscription)
          .where(eq(schema.subscription.tenantId, demoTenant.id));
        if (!has.length)
          await createTrialSubscription(tx, demoTenant.id, {
            planId: trial.id,
            period: null,
            amountCents: null,
            vat: {
              enabled: trial.vatEnabled,
              included: trial.vatIncluded,
              rateBp: trial.vatRateBp,
            },
            trialDays: trial.trialDays ?? 30,
          });
      },
    );
  }
  if (demo) {
    await withTenant({ tenantId: demo.id }, async (tx) => {
      await seedTenantRoles(tx, demo.id);
      await tx.insert(schema.tenantBranding).values({ tenantId: demo.id });
    });
    // Usuario demo (solo fuera de producción): administrador de la empresa demo.
    {
      const id = uuidv7();
      await db
        .insert(schema.user)
        .values({ id, name: "Ana Demo", email: "demo@demo.test", emailVerified: true });
      await db.insert(schema.account).values({
        id: uuidv7(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: await hashPassword("DemoClave-2026!"),
      });
      const [admin] = await db
        .select()
        .from(schema.role)
        .where(and(eq(schema.role.tenantId, demo.id), eq(schema.role.systemKey, "ADMIN_EMPRESA")));
      await db
        .insert(schema.membership)
        .values({ tenantId: demo.id, userId: id, roleId: admin.id });
    }
    console.log("Empresa demo creada");
  }
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seed().then(closeDb, async (e) => {
    console.error(e);
    await closeDb();
    process.exit(1);
  });
}
