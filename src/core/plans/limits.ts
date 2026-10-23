import "server-only";
import { and, count, eq, gte, isNull, ne, or, sql, sum } from "drizzle-orm";
import { schema, withPlatform } from "@/core/db";
import { writability, type SubStatus } from "@/modules/billing/lifecycle";
import type { PlanLimits, PlanModuleKey } from "./modules";

/**
 * Entitlements de una empresa: límites, módulos y modo de solo lectura. Se aplican SIEMPRE en el
 * servidor (acciones y rutas), nunca solo en la interfaz.
 */
export class PlanLimitError extends Error {
  code = "PLAN_LIMIT" as const;
  constructor(
    public metric: keyof PlanLimits,
    public limit: number,
    public current: number,
  ) {
    super(
      `Superaste el límite de ${LABEL[metric]} de tu plan (${limit}). Actualiza tu plan para continuar.`,
    );
  }
}
export class ModuleDisabledError extends Error {
  code = "MODULE_DISABLED" as const;
  constructor(public module: string) {
    super("Este módulo no está incluido en tu plan. Actualiza tu plan para usarlo.");
  }
}
export class ReadOnlyError extends Error {
  code = "READ_ONLY" as const;
  constructor(public reason: "suspended" | "cancelled") {
    super(
      reason === "suspended"
        ? "Tu cuenta está suspendida: solo puedes consultar. Regulariza tu suscripción para volver a editar."
        : "La suscripción está cancelada: solo puedes consultar y exportar tus datos.",
    );
  }
}

const LABEL: Record<keyof PlanLimits, string> = {
  workers: "trabajadores",
  users: "usuarios",
  centers: "sedes",
  storageMb: "almacenamiento (MB)",
};

/** Puro: ¿cabe `increment` más sin pasar el límite? (`null` = ilimitado). */
export function withinLimit(limit: number | null, current: number, increment = 1): boolean {
  return limit === null || current + increment <= limit;
}

export type Entitlements = {
  status: SubStatus;
  limits: PlanLimits;
  modules: string[];
  planKey: string;
};

export async function getEntitlements(tenantId: string): Promise<Entitlements> {
  return withPlatform(
    { actorId: "system", action: "entitlements.read", tenantId, audit: false },
    async (tx) => {
      const [row] = await tx
        .select({
          status: schema.subscription.status,
          limits: schema.plan.limits,
          modules: schema.plan.modules,
          planKey: schema.plan.key,
        })
        .from(schema.subscription)
        .innerJoin(schema.plan, eq(schema.plan.id, schema.subscription.planId))
        .where(eq(schema.subscription.tenantId, tenantId));
      if (!row) throw new Error("La empresa no tiene suscripción");
      return row;
    },
  );
}

/** Contadores de uso por métrica. Los módulos nuevos registran el suyo (p. ej. trabajadores en la Fase 2). */
type Counter = (tenantId: string) => Promise<number>;
const counters: Record<keyof PlanLimits, Counter> = {
  users: (tenantId) =>
    withPlatform(
      { actorId: "system", action: "usage.users", tenantId, audit: false },
      async (tx) => {
        const [r] = await tx
          .select({ n: count() })
          .from(schema.membership)
          .where(
            and(eq(schema.membership.tenantId, tenantId), eq(schema.membership.status, "active")),
          );
        return r.n;
      },
    ),
  centers: (tenantId) =>
    withPlatform(
      { actorId: "system", action: "usage.centers", tenantId, audit: false },
      async (tx) => {
        const [r] = await tx
          .select({ n: count() })
          .from(schema.workCenter)
          .where(
            and(eq(schema.workCenter.tenantId, tenantId), isNull(schema.workCenter.deletedAt)),
          );
        return r.n;
      },
    ),
  storageMb: (tenantId) =>
    withPlatform(
      { actorId: "system", action: "usage.storage", tenantId, audit: false },
      async (tx) => {
        const [r] = await tx
          .select({ bytes: sum(schema.file.size) })
          .from(schema.file)
          .where(and(eq(schema.file.tenantId, tenantId), isNull(schema.file.deletedAt)));
        return Math.ceil(Number(r.bytes ?? 0) / (1024 * 1024));
      },
    ),
  // Trabajadores activos (sin retiro o con retiro futuro); los contratistas no cuentan contra el límite.
  workers: (tenantId) =>
    withPlatform(
      { actorId: "system", action: "usage.workers", tenantId, audit: false },
      async (tx) => {
        const [r] = await tx
          .select({ n: count() })
          .from(schema.worker)
          .where(
            and(
              eq(schema.worker.tenantId, tenantId),
              isNull(schema.worker.deletedAt),
              ne(schema.worker.kind, "contractor"),
              or(isNull(schema.worker.endDate), gte(schema.worker.endDate, sql`current_date`)),
            ),
          );
        return r.n;
      },
    ),
};

export function registerUsageCounter(metric: keyof PlanLimits, counter: Counter) {
  counters[metric] = counter;
}

export async function usageOf(tenantId: string, metric: keyof PlanLimits) {
  return counters[metric](tenantId);
}

/** Lanza PlanLimitError si agregar `increment` supera el límite del plan. */
export async function assertCanAdd(tenantId: string, metric: keyof PlanLimits, increment = 1) {
  const { limits } = await getEntitlements(tenantId);
  const limit = limits[metric];
  if (limit === null) return;
  const current = await usageOf(tenantId, metric);
  if (!withinLimit(limit, current, increment)) throw new PlanLimitError(metric, limit, current);
}

export async function assertModuleEnabled(tenantId: string, module: PlanModuleKey) {
  const { modules } = await getEntitlements(tenantId);
  if (!modules.includes(module)) throw new ModuleDisabledError(module);
}

/** Lanza ReadOnlyError si la empresa está suspendida o cancelada. Llamar al inicio de toda acción que escriba. */
export async function assertWritable(tenantId: string) {
  const { status } = await getEntitlements(tenantId);
  const w = writability(status);
  if (!w.writable) throw new ReadOnlyError(w.reason!);
}
