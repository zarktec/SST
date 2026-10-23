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
