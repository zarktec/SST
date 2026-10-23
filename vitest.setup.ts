import { beforeAll } from "vitest";
import { Pool } from "pg";

/**
 * Cada archivo de pruebas arranca con las tablas vacías (los archivos corren en serie sobre la misma BD).
 * `session_replication_role = replica` desactiva los triggers de solo-inserción durante el vaciado.
 */
beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return;
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const { rows } = await pool.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
    );
    if (rows.length) {
      const client = await pool.connect();
      try {
        await client.query("SET session_replication_role = replica");
        await client.query(
          `TRUNCATE ${rows.map((r) => `"${r.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`,
        );
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
});
