import "dotenv/config";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { closeDb, schema, systemDb, withTenant } from "../src/core/db";
import { seedTenantRoles } from "../src/core/rbac/seed-roles";
import { ensureIntegrations } from "../src/integrations/registry/service";
import { uuidv7 } from "../src/lib/uuid";

/** Seed idempotente: SUPER ADMIN inicial (variables de entorno), integraciones y empresa demo. */
export async function seed() {
  const db = systemDb();
  await ensureIntegrations();

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
  if (demo) {
    await withTenant({ tenantId: demo.id }, async (tx) => {
      await seedTenantRoles(tx, demo.id);
      await tx.insert(schema.tenantBranding).values({ tenantId: demo.id });
    });
    const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";
    await db
      .insert(schema.tenantDomain)
      .values({ tenantId: demo.id, host: `demo.${root}`, kind: "subdomain", status: "verified" })
      .onConflictDoNothing();
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
