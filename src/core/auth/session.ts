import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { schema, systemDb } from "@/core/db";
import { classifyHost } from "@/core/tenancy/hosts";
import { resolveTenantByHost, type ResolvedTenant } from "@/core/tenancy/resolve";
import { getAuth } from "./config";

export async function currentHost(): Promise<string> {
  return (await headers()).get("host") ?? "";
}

export async function getSession() {
  const h = await headers();
  const auth = await getAuth(h.get("host") ?? "");
  return auth.api.getSession({ headers: h });
}

/**
 * Guard del panel SUPER ADMIN (host `admin.`). Exige sesión, personal de plataforma y 2FA activo:
 * sin 2FA solo puede llegar a la pantalla de activación.
 */
export async function requirePlatformStaff(
  opts: { allow?: ("SUPER_ADMIN" | "SOPORTE_PLATAFORMA")[]; skip2fa?: boolean } = {},
) {
  if (classifyHost(await currentHost()).kind !== "admin") redirect("/");
  const s = await getSession();
  if (!s) redirect("/login");
  const [staff] = await systemDb()
    .select()
    .from(schema.platformStaff)
    .where(eq(schema.platformStaff.userId, s.user.id));
  if (!staff || (opts.allow && !opts.allow.includes(staff.role)))
    redirect("/login?error=forbidden");
  if (!opts.skip2fa && !s.user.twoFactorEnabled) redirect("/security/2fa");
  return { user: s.user, session: s.session, role: staff.role };
}

export type TenantSessionContext = {
  tenant: ResolvedTenant;
  user: { id: string; email: string; name: string };
  membershipId: string;
  roleId: string;
  roleKey: string | null;
  /** Empresa suspendida: solo lectura. */
  readOnly: boolean;
};

/** Contexto de la empresa del host actual + membresía activa del usuario. Redirige a /login si falta. */
export async function requireTenantMember(): Promise<TenantSessionContext> {
  const host = await currentHost();
  const tenant = await resolveTenantByHost(host);
  if (!tenant) redirect("/");
  const s = await getSession();
  if (!s) redirect("/login");
  const [m] = await systemDb()
    .select({
      id: schema.membership.id,
      roleId: schema.membership.roleId,
      status: schema.membership.status,
      expiresAt: schema.membership.expiresAt,
      systemKey: schema.role.systemKey,
    })
    .from(schema.membership)
    .innerJoin(schema.role, eq(schema.role.id, schema.membership.roleId))
    .where(
      and(eq(schema.membership.tenantId, tenant.tenantId), eq(schema.membership.userId, s.user.id)),
    );
  if (!m || m.status !== "active" || (m.expiresAt && m.expiresAt <= new Date()))
    redirect("/login?error=forbidden");
  const [t] = await systemDb()
    .select({ deletedAt: schema.tenant.deletedAt })
    .from(schema.tenant)
    .where(and(eq(schema.tenant.id, tenant.tenantId), isNull(schema.tenant.deletedAt)));
  if (!t) redirect("/");
  return {
    tenant,
    user: { id: s.user.id, email: s.user.email, name: s.user.name },
    membershipId: m.id,
    roleId: m.roleId,
    roleKey: m.systemKey,
    readOnly: tenant.status === "suspended",
  };
}
