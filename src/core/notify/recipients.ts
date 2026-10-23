import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { schema, withPlatform } from "@/core/db";

/** Correos de los usuarios activos de una empresa con alguno de los roles de sistema indicados (para avisos y escalamientos). */
export async function emailsForRoles(tenantId: string, roleKeys: string[]): Promise<string[]> {
  const rows = await withPlatform(
    { actorId: "system", action: "notify.recipients", tenantId, audit: false },
    (tx) =>
      tx
        .select({ email: schema.user.email })
        .from(schema.membership)
        .innerJoin(schema.user, eq(schema.user.id, schema.membership.userId))
        .innerJoin(schema.role, eq(schema.role.id, schema.membership.roleId))
        .where(
          and(
            eq(schema.membership.tenantId, tenantId),
            eq(schema.membership.status, "active"),
            inArray(schema.role.systemKey, roleKeys),
          ),
        ),
  );
  return [...new Set(rows.map((r) => r.email))];
}
