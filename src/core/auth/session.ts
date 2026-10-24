import "server-only";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { schema, systemDb, withTenant } from "@/core/db";
import { loadPermissions, scopeOf } from "@/core/rbac/can";
import type { Action, PermissionModule } from "@/core/rbac/roles";
import { tp } from "@/core/tenancy/base-path";
import { classifyHost } from "@/core/tenancy/hosts";
import { resolveTenantById, type ResolvedTenant } from "@/core/tenancy/resolve";
import { resolveTenantAccess } from "./access";
import { getAuth } from "./config";

export async function currentHost(): Promise<string> {
  return (await headers()).get("host") ?? "";
}

/** Empresa de la petición actual (la resolvió el proxy por ruta `/{slug}` o dominio propio). */
export async function currentTenant(): Promise<ResolvedTenant | null> {
  const id = (await headers()).get("x-tenant-id");
  return id ? resolveTenantById(id) : null;
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
 * Contexto de la empresa de la petición actual + acceso del usuario. Aplica las mismas reglas que el
 * traspaso de sesión (invitación, dominio permitido, solo-SSO, expiración) en CADA request.
 */
export async function requireTenantMember(): Promise<TenantSessionContext> {
  const tenant = await currentTenant();
  if (!tenant) redirect("/");
  const s = await getSession();
  if (!s) redirect(await tp("/login"));
  const loginMethod = (s.session as { loginMethod?: string | null }).loginMethod ?? null;
  const access = await resolveTenantAccess({
    userId: s.user.id,
    email: s.user.email,
    emailVerified: s.user.emailVerified,
    tenantId: tenant.tenantId,
    loginMethod,
  });
  if (!access.ok)
    redirect(
      await tp(`/login?error=${access.reason === "sso_required" ? "sso_required" : "forbidden"}`),
    );
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

export class ForbiddenError extends Error {
  constructor() {
    super("No tienes permiso para esta acción");
  }
}

/**
 * Guard por permiso (módulo + acción) para páginas y acciones de la empresa. Devuelve el contexto con el alcance
 * concedido. En acciones que escriben, además exige que la cuenta no esté suspendida (solo lectura).
 */
export async function requirePermission(module: PermissionModule, action: Action) {
  const ctx = await requireTenantMember();
  const perms = await withTenant({ tenantId: ctx.tenant.tenantId }, (tx) =>
    loadPermissions(tx, ctx.roleId),
  );
  const scope = scopeOf(perms, module, action);
  if (!scope) redirect(await tp("/"));
  if (action !== "view" && action !== "export" && ctx.readOnly) throw new ForbiddenError();
  return { ...ctx, scope, permissions: perms };
}
