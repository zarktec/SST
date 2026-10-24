import "server-only";
import { sql } from "drizzle-orm";
import { withTenant } from "@/core/db";
import { toCsv } from "@/core/reports/csv";
import { buildZip, type ZipEntry } from "@/core/reports/zip";

/**
 * Columnas que NO se exportan: contenido cifrado, firmas y huellas de evidencia (son binarios o ilegibles fuera de la
 * plataforma), tokens y credenciales. Los datos sensibles de salud y quejas se entregan con el procedimiento de autorización
 * del titular (TODO-NORMA: Ley 1581 de 2012).
 */
const SKIP_COL = /(encrypted|signature|token|secret|password|blind|hash|ciphertext|nonce)/i;
/** Tablas con tenant_id que no hacen parte de los datos de la empresa (facturación, sesiones, métodos de pago). */
const SKIP_TABLE =
  /^(payment_source|payment|invoice|billing_profile|subscription|subscription_event|session|account|verification|two_factor|rate_limit|push_subscription)$/;

/** ZIP con un CSV por tabla de negocio de la empresa (portabilidad y cierre de cuenta). */
export async function exportAllData(tenantId: string, tenantName: string) {
  return withTenant({ tenantId }, async (tx) => {
    const tables = (
      await tx.execute(
        sql`select distinct table_name from information_schema.columns where table_schema = 'public' and column_name = 'tenant_id' order by table_name`,
      )
    ).rows as { table_name: string }[];
    const entries: ZipEntry[] = [];
    const summary: string[] = [];
    for (const { table_name } of tables) {
      if (SKIP_TABLE.test(table_name) || !/^[a-z0-9_]+$/.test(table_name)) continue;
      const cols = (
        await tx.execute(
          sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = ${table_name} order by ordinal_position`,
        )
      ).rows as { column_name: string }[];
      const keep = cols.map((c) => c.column_name).filter((c) => !SKIP_COL.test(c));
      if (!keep.length) continue;
      const list = keep.map((c) => `"${c}"`).join(", ");
      const rows = (
        await tx.execute(
          sql.raw(
            `select ${list} from "${table_name}" where tenant_id = '${tenantId.replace(/[^0-9a-f-]/gi, "")}'`,
          ),
        )
      ).rows as Record<string, unknown>[];
      if (!rows.length) continue;
      entries.push({
        path: `datos/${table_name}.csv`,
        data: toCsv({
          name: table_name,
          head: keep,
          rows: rows.map((r) =>
            keep.map((k) =>
              r[k] instanceof Date
                ? (r[k] as Date).toISOString()
                : typeof r[k] === "object" && r[k] !== null
                  ? JSON.stringify(r[k])
                  : (r[k] as string | number | boolean | null),
            ),
          ),
        }),
      });
      summary.push(`${table_name}: ${rows.length} fila(s)`);
    }
    entries.unshift({
      path: "LEEME.txt",
      data: `Exportación de datos de ${tenantName}\nGenerada: ${new Date().toISOString()}\n\nUn archivo CSV por tabla (codificación UTF-8). No incluye contenido cifrado (salud, quejas), firmas, huellas ni credenciales: esos datos se entregan con el procedimiento de autorización del titular.\n\n${summary.join("\n")}\n`,
    });
    return buildZip(entries).zip;
  });
}
