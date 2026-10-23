import { and, eq } from "drizzle-orm";
import { schema, systemDb } from "@/core/db";

/** Host preferido de una empresa: dominio propio verificado si existe; si no, su subdominio. */
export async function primaryHostForTenant(tenantId: string): Promise<string | null> {
  const rows = await systemDb()
    .select()
    .from(schema.tenantDomain)
    .where(
      and(eq(schema.tenantDomain.tenantId, tenantId), eq(schema.tenantDomain.status, "verified")),
    );
  return (rows.find((r) => r.kind === "custom") ?? rows[0])?.host ?? null;
}
