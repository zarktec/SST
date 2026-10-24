import "server-only";
import { sql } from "drizzle-orm";
import { systemDb } from "@/core/db";

/**
 * Límite de intentos compartido entre instancias serverless (usa la tabla `rate_limit` de Better Auth, con un prefijo propio para
 * no chocar con sus llaves). Atómico: un único INSERT … ON CONFLICT cuenta y decide. Devuelve true si se superó el máximo.
 */
export async function tooManyAttempts(
  key: string,
  max: number,
  windowSeconds: number,
): Promise<boolean> {
  const k = `app:${key}`.slice(0, 200);
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const r = await systemDb().execute(sql`
    INSERT INTO rate_limit (id, key, count, last_request)
    VALUES (${k}, ${k}, 1, ${now})
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN ${now} - rate_limit.last_request > ${windowMs} THEN 1 ELSE rate_limit.count + 1 END,
      last_request = CASE WHEN ${now} - rate_limit.last_request > ${windowMs} THEN ${now} ELSE rate_limit.last_request END
    RETURNING count`);
  return Number((r.rows[0] as { count: number }).count) > max;
}
