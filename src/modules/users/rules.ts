import { z } from "zod";

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Correo inválido")),
  roleId: z.uuid("Selecciona el rol"),
});

/**
 * La empresa siempre debe conservar al menos un administrador activo: no se puede quitar el último (ni desactivarlo ni cambiarle
 * el rol).
 */
export function leavesNoAdmin(
  members: { id: string; roleKey: string | null; status: string }[],
  change: { memberId: string; newRoleKey?: string | null; newStatus?: string },
): boolean {
  const after = members.map((m) =>
    m.id === change.memberId
      ? {
          ...m,
          roleKey: change.newRoleKey !== undefined ? change.newRoleKey : m.roleKey,
          status: change.newStatus ?? m.status,
        }
      : m,
  );
  return !after.some((m) => m.roleKey === "ADMIN_EMPRESA" && m.status === "active");
}
