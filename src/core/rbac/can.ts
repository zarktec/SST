import { eq } from "drizzle-orm";
import { schema, type Tx } from "@/core/db";
import type { Action, PermissionModule, Scope } from "./roles";

export type Permissions = Map<string, Scope>;
const SCOPE_RANK: Record<Scope, number> = { own: 0, team: 1, center: 2, all: 3 };
const key = (m: string, a: string) => `${m}:${a}`;

/** Permisos efectivos de un rol (el alcance más amplio gana si hubiera duplicados). */
export async function loadPermissions(tx: Tx, roleId: string): Promise<Permissions> {
  const rows = await tx
    .select()
    .from(schema.rolePermission)
    .where(eq(schema.rolePermission.roleId, roleId));
  const out: Permissions = new Map();
  for (const r of rows) {
    const k = key(r.module, r.action);
    const prev = out.get(k);
    if (!prev || SCOPE_RANK[r.scope] > SCOPE_RANK[prev]) out.set(k, r.scope);
  }
  return out;
}

/** Alcance con que el rol puede hacer `action` en `module`, o null si no puede. */
export const scopeOf = (p: Permissions, module: PermissionModule, action: Action): Scope | null =>
  p.get(key(module, action)) ?? null;

export const can = (p: Permissions, module: PermissionModule, action: Action): boolean =>
  scopeOf(p, module, action) !== null;
