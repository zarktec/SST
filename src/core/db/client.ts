import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { Pool as NeonPool } from "@neondatabase/serverless";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

type Cache = { pool?: Pool | NeonPool; db?: Db; url?: string };
const globalCache = globalThis as unknown as { __sstDb?: Cache };

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  return url;
}

/** Neon usa el driver serverless (WebSocket, con transacciones); local/CI usa `pg`. */
function create(url: string): { pool: Pool | NeonPool; db: Db } {
  if (new URL(url).hostname.endsWith("neon.tech")) {
    const pool = new NeonPool({ connectionString: url });
    return {
      pool,
      db: drizzleNeon({ client: pool, schema, casing: "snake_case" }) as unknown as Db,
    };
  }
  const pool = new Pool({ connectionString: url, max: 10 });
  return { pool, db: drizzle({ client: pool, schema, casing: "snake_case" }) };
}

/**
 * Conexión sin rol restringido. SOLO para tablas globales (auth, catálogos, integraciones) y la
 * resolución de dominios en `src/core/**`, `src/integrations/**` y `src/modules/platform/**`.
 * Nunca para leer/escribir datos de negocio: usar `withTenant`.
 */
export function systemDb(): Db {
  const url = databaseUrl();
  const cache = (globalCache.__sstDb ??= {});
  if (!cache.db || cache.url !== url) {
    void cache.pool?.end();
    const created = create(url);
    cache.pool = created.pool;
    cache.db = created.db;
    cache.url = url;
  }
  return cache.db;
}

export async function closeDb(): Promise<void> {
  const cache = globalCache.__sstDb;
  if (cache?.pool) await cache.pool.end();
  globalCache.__sstDb = undefined;
}
