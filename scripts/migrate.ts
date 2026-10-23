import { config } from "dotenv";
config({ path: ".env.local" });
config();
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/** Aplica las migraciones versionadas. Uso: pnpm db:migrate (DATABASE_URL). */
export async function runMigrations(url: string) {
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  runMigrations(url).then(
    () => console.log("Migraciones aplicadas"),
    (e) => {
      console.error(e);
      process.exit(1);
    },
  );
}
