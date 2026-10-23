import { sql } from "drizzle-orm";
import { systemDb } from "./client";
import { tenant } from "./schema";

export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

/** Usa la BD de pruebas como DATABASE_URL en los tests. */
export function pointToTestDb() {
  if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

export async function createTenant(slug: string) {
  const [row] = await systemDb()
    .insert(tenant)
    .values({ slug, legalName: `${slug} SAS`, tradeName: slug })
    .returning();
  return row;
}

export async function resetData() {
  await systemDb()
    .execute(sql`TRUNCATE tenant CASCADE`)
    .catch(() => undefined);
}

/** Drizzle envuelve el error de pg en "Failed query"; el motivo real está en `cause`. */
export async function dbErrorMessage(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const err = e as Error & { cause?: Error };
    return `${err.message} ${err.cause?.message ?? ""}`;
  }
  return "";
}

/** Empresa con suscripción de prueba (toda empresa real nace con una; los límites de plan la requieren). */
export async function createTenantWithSubscription(
  slug: string,
  limits?: { users?: number | null },
) {
  const { createPlan, getPlanByKey } = await import("@/modules/platform/plans/service");
  const { createTrialSubscription } = await import("@/modules/billing/subscriptions");
  const { withPlatform } = await import("./context");
  const key = `test-${limits?.users ?? "unl"}`;
  const planId =
    (await getPlanByKey(key))?.id ??
    (await createPlan({
      key,
      name: key,
      description: "",
      isTrial: false,
      trialDays: null,
      vatEnabled: false,
      vatIncluded: false,
      vatRatePercent: 0,
      limits: { workers: null, users: limits?.users ?? null, centers: null, storageMb: null },
      modules: [],
      visible: false,
      sortOrder: 0,
      active: true,
      monthlyPesos: 1000,
      annualPesos: null,
      monthlySiigoCode: null,
      annualSiigoCode: null,
    }));
  const t = await createTenant(slug);
  await withPlatform(
    { actorId: "test", action: "test.subscription", tenantId: t.id, audit: false },
    (tx) =>
      createTrialSubscription(tx, t.id, {
        planId,
        period: "monthly",
        amountCents: 100_000n,
        vat: { enabled: false, included: false, rateBp: 0 },
        trialDays: 30,
      }),
  );
  return t;
}
