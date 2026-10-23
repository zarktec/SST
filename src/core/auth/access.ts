import { and, eq, isNull } from "drizzle-orm";
import { schema, systemDb } from "@/core/db";

const { tenant, membership, invitation, role } = schema;

export type AccessDenied =
  | "tenant_not_found"
  | "tenant_cancelled"
  | "sso_required"
  | "membership_disabled"
  | "membership_expired"
  | "not_invited";
export type AccessResult =
  | { ok: true; tenantId: string; membershipId: string; created: "invitation" | "domain" | null }
  | { ok: false; reason: AccessDenied };

const SSO_METHODS = new Set(["google", "microsoft"]);

/**
 * ¿Puede este usuario entrar a esta empresa? (spec 5.9)
 *  1. Ya es miembro activo (y no ha expirado su acceso temporal).
 *  2. Tiene una invitación vigente → se crea la membresía con el rol invitado.
 *  3. Su correo está verificado y su dominio está en la lista de dominios permitidos de la empresa
 *     → se crea la membresía con el rol de menor privilegio (TRABAJADOR).
 *  Si la empresa exige solo SSO, únicamente se aceptan inicios de sesión con Google o Microsoft.
 */
export async function resolveTenantAccess(
  input: {
    userId: string;
    email: string;
    emailVerified: boolean;
    tenantId: string;
    loginMethod: string | null;
  },
  now = new Date(),
): Promise<AccessResult> {
  const db = systemDb();
  const [t] = await db
    .select()
    .from(tenant)
    .where(and(eq(tenant.id, input.tenantId), isNull(tenant.deletedAt)));
  if (!t) return { ok: false, reason: "tenant_not_found" };
  if (t.status === "cancelled") return { ok: false, reason: "tenant_cancelled" };
  if (t.ssoOnly && !SSO_METHODS.has(input.loginMethod ?? ""))
    return { ok: false, reason: "sso_required" };

  const [m] = await db
    .select()
    .from(membership)
    .where(and(eq(membership.tenantId, t.id), eq(membership.userId, input.userId)));
  if (m) {
    if (m.status === "disabled") return { ok: false, reason: "membership_disabled" };
    if (m.expiresAt && m.expiresAt <= now) return { ok: false, reason: "membership_expired" };
    if (m.status === "active")
      return { ok: true, tenantId: t.id, membershipId: m.id, created: null };
  }

  const email = input.email.toLowerCase();
  const [inv] = await db
    .select()
    .from(invitation)
    .where(
      and(
        eq(invitation.tenantId, t.id),
        eq(invitation.email, email),
        isNull(invitation.acceptedAt),
      ),
    );
  if (inv && inv.expiresAt > now && input.emailVerified) {
    const membershipId = await db.transaction(async (tx) => {
      await tx.update(invitation).set({ acceptedAt: now }).where(eq(invitation.id, inv.id));
      const [row] = await tx
        .insert(membership)
        .values({ tenantId: t.id, userId: input.userId, roleId: inv.roleId, status: "active" })
        .onConflictDoUpdate({
          target: [membership.tenantId, membership.userId],
          set: { roleId: inv.roleId, status: "active" },
        })
        .returning();
      return row.id;
    });
    return { ok: true, tenantId: t.id, membershipId, created: "invitation" };
  }

  const domain = email.split("@")[1];
  if (
    input.emailVerified &&
    domain &&
    t.allowedEmailDomains.map((d) => d.toLowerCase()).includes(domain)
  ) {
    const [worker] = await db
      .select()
      .from(role)
      .where(and(eq(role.tenantId, t.id), eq(role.systemKey, "TRABAJADOR")));
    if (worker) {
      const [row] = await db
        .insert(membership)
        .values({ tenantId: t.id, userId: input.userId, roleId: worker.id, status: "active" })
        .onConflictDoNothing()
        .returning();
      if (row) return { ok: true, tenantId: t.id, membershipId: row.id, created: "domain" };
    }
  }
  return { ok: false, reason: "not_invited" };
}

/** Empresas a las que pertenece un usuario (selector de empresa tras entrar). */
export async function listUserTenants(userId: string) {
  return systemDb()
    .select({
      tenantId: tenant.id,
      slug: tenant.slug,
      name: tenant.tradeName,
      status: tenant.status,
    })
    .from(membership)
    .innerJoin(tenant, eq(tenant.id, membership.tenantId))
    .where(
      and(eq(membership.userId, userId), eq(membership.status, "active"), isNull(tenant.deletedAt)),
    );
}
