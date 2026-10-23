import { runMigrations } from "./scripts/migrate";
import { Pool } from "pg";

/** Recrea el esquema de la BD de pruebas y aplica todas las migraciones antes de correr los tests. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  process.env.ENCRYPTION_MASTER_KEY ??= Buffer.alloc(32, 7).toString("base64");
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await pool.query(
      "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;",
    );
  } finally {
    await pool.end();
  }
  await runMigrations(url);
}
