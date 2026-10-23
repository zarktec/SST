import { spawnSync } from "node:child_process";

/**
 * Build de Vercel. En producción aplica las migraciones y el seed idempotente (SUPER ADMIN +
 * integraciones) ANTES de compilar; si la migración falla, el deploy falla y no sale código
 * incompatible con el esquema. Preview no toca la base de datos (usar rama de Neon por preview).
 */
function run(cmd: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env, shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (process.env.VERCEL_ENV === "production") {
  // Migraciones por conexión directa (sin pooler): DDL y transacciones largas.
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.error("Falta DATABASE_URL: instala Neon en el proyecto de Vercel.");
    process.exit(1);
  }
  const env = { ...process.env, DATABASE_URL: url };
  console.log("▶ Aplicando migraciones…");
  run("pnpm", ["db:migrate"], env);
  console.log("▶ Seed idempotente…");
  run("pnpm", ["db:seed"], env);
}

run("pnpm", ["exec", "next", "build"]);
