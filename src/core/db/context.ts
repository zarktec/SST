import { sql } from "drizzle-orm";
import { z } from "zod";
import { systemDb, type Tx } from "./client";
import { auditLog } from "./schema";

const uuidSchema = z.uuid();

export type TenantContext = {
  tenantId: string;
  userId?: string;
  /** Clave del rol, para políticas que dependan del rol (p. ej. quejas confidenciales). */
  role?: string;
};

/**
 * Ejecuta `fn` en una transacción con el contexto de una empresa: `SET LOCAL ROLE app_tenant`
 * (sujeto a RLS) y `app.tenant_id`/`app.user_id`/`app.role` solo durante la transacción.
 * No existe forma de consultar tablas de negocio sin pasar por aquí (default-deny).
 */
export async function withTenant<T>(ctx: TenantContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const tenantId = uuidSchema.parse(ctx.tenantId);
  return systemDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE app_tenant`);
    await tx.execute(
      sql`SELECT set_config('app.tenant_id', ${tenantId}, true),
                 set_config('app.user_id', ${ctx.userId ?? ""}, true),
                 set_config('app.role', ${ctx.role ?? ""}, true)`,
    );
    return fn(tx);
  });
}

export type PlatformContext = {
  actorId: string;
  /** Qué se va a hacer (queda en audit_log). Obligatorio. */
  action: string;
  /** Empresa afectada, si aplica. */
  tenantId?: string;
  /** Motivo (obligatorio al impersonar). */
  reason?: string;
};

/**
 * Acceso del SUPER ADMIN / soporte por encima del aislamiento por empresa. Cada uso queda
 * auditado. Los datos sensibles (salud, convivencia) requieren autorización vigente del tenant
 * (`tenant.sensitive_access_granted_until`), que se valida en las consultas de esos módulos.
 */
export async function withPlatform<T>(
  ctx: PlatformContext,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  if (!ctx.actorId || !ctx.action) throw new Error("withPlatform requiere actorId y action");
  return systemDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE app_platform`);
    await tx.execute(
      sql`SELECT set_config('app.is_platform', 'true', true),
                 set_config('app.user_id', ${ctx.actorId}, true)`,
    );
    await tx.insert(auditLog).values({
      tenantId: ctx.tenantId,
      actorId: ctx.actorId,
      action: ctx.action,
      entity: "platform_access",
      after: ctx.reason ? { reason: ctx.reason } : null,
    });
    return fn(tx);
  });
}
