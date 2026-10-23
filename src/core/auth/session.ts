import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { schema, systemDb } from "@/core/db";
import { classifyHost } from "@/core/tenancy/hosts";
import { resolveTenantByHost, type ResolvedTenant } from "@/core/tenancy/resolve";
import { resolveTenantAccess } from "./access";
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

/**
 * Contexto de la empresa del host actual + acceso del usuario. Aplica las mismas reglas que el
 * traspaso de sesión (invitación, dominio permitido, solo-SSO, expiración) en CADA request.
 */
export async function requireTenantMember(): Promise<TenantSessionContext> {
  const host = await currentHost();
  const tenant = await resolveTenantByHost(host);
  if (!tenant) redirect("/");
  const s = await getSession();
  if (!s) redirect("/login");
  const loginMethod = (s.session as { loginMethod?: string | null }).loginMethod ?? null;
  const access = await resolveTenantAccess({
    userId: s.user.id,
    email: s.user.email,
    emailVerified: s.user.emailVerified,
    tenantId: tenant.tenantId,
    loginMethod,
  });
  if (!access.ok)
    redirect(`/login?error=${access.reason === "sso_required" ? "sso_required" : "forbidden"}`);
  const [m] = await systemDb()
    .select({ roleId: schema.membership.roleId, systemKey: schema.role.systemKey })
    .from(schema.membership)
    .innerJoin(schema.role, eq(schema.role.id, schema.membership.roleId))
    .where(eq(schema.membership.id, access.membershipId));
  return {
    tenant,
    user: { id: s.user.id, email: s.user.email, name: s.user.name },
    membershipId: access.membershipId,
    roleId: m.roleId,
    roleKey: m.systemKey,
    readOnly: tenant.status === "suspended",
  };
}
