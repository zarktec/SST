import type { Tx } from "@/core/db";
import { schema } from "@/core/db";
import { defaultPermissions, SYSTEM_ROLES } from "./roles";

/** Crea los roles de sistema (con sus permisos por defecto) de una empresa. Idempotente por nombre. */
export async function seedTenantRoles(tx: Tx, tenantId: string) {
  for (const r of SYSTEM_ROLES) {
    const [row] = await tx
      .insert(schema.role)
      .values({ tenantId, systemKey: r.key, name: r.name })
      .onConflictDoNothing()
      .returning();
    if (!row) continue;
    const perms = defaultPermissions(r.key);
    if (perms.length) {
      await tx
        .insert(schema.rolePermission)
        .values(perms.map((p) => ({ tenantId, roleId: row.id, ...p })))
        .onConflictDoNothing();
    }
  }
}
