"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import { activitySchema, STATUSES, type ActivityStatus } from "@/modules/annual-plan/rules";
import {
  PlanError,
  getOrCreatePlan,
  reopenPlan,
  saveActivity,
  setStatus,
  signPlan,
  suggestActivities,
} from "@/modules/annual-plan/service";

const known = (e: unknown) =>
  e instanceof PlanError ||
  (e instanceof Error &&
    ["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code)));
const fail = (e: unknown, f?: FormData): FormState => ({
  ok: false,
  message: known(e) ? (e as Error).message : "No se pudo completar la acción.",
  values: f ? formValues(f) : undefined,
});
const done = () => revalidatePath("/plan-anual");

export async function createPlanAction(year: number): Promise<FormState> {
  const ctx = await requirePermission("annual_plan", "create");
  try {
    await getOrCreatePlan(ctx.tenant.tenantId, ctx.user.id, year);
    done();
    return { ok: true, message: "Plan creado." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveActivityAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("annual_plan", "edit");
  const raw = Object.fromEntries(f);
  const parsed = activitySchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
      values: formValues(f),
    };
  try {
    await saveActivity(
      ctx.tenant.tenantId,
      ctx.user.id,
      String(f.get("planId")),
      raw as never,
      String(f.get("activityId") ?? "") || undefined,
    );
    done();
    return { ok: true, message: "Actividad guardada." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function setStatusAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("annual_plan", "edit");
  const status = String(f.get("status")) as ActivityStatus;
  if (!STATUSES.includes(status)) return { ok: false, message: "Estado inválido" };
  try {
    await setStatus(
      ctx.tenant.tenantId,
      ctx.user.id,
      String(f.get("activityId")),
      status,
      String(f.get("evidence") ?? ""),
    );
    done();
    return { ok: true, message: "Estado actualizado." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function suggestAction(planId: string): Promise<FormState> {
  const ctx = await requirePermission("annual_plan", "edit");
  try {
    const n = await suggestActivities(ctx.tenant.tenantId, ctx.user.id, planId);
    done();
    return {
      ok: true,
      message: n
        ? `Se agregaron ${n} actividades sugeridas.`
        : "No hay actividades nuevas por sugerir.",
    };
  } catch (e) {
    return fail(e);
  }
}

/** Empleador: alta dirección o administrador de la empresa. Responsable del SG-SST: su rol. */
export async function signAction(
  planId: string,
  as: "employer" | "responsible",
): Promise<FormState> {
  const ctx = await requirePermission("annual_plan", "approve");
  const allowed = as === "employer" ? ["ALTA_DIRECCION", "ADMIN_EMPRESA"] : ["RESPONSABLE_SST"];
  if (!ctx.roleKey || !allowed.includes(ctx.roleKey))
    return {
      ok: false,
      message:
        as === "employer"
          ? "Solo la alta dirección o el administrador firman como empleador."
          : "Solo el responsable del SG-SST firma como tal.",
    };
  try {
    const r = await signPlan(ctx.tenant.tenantId, ctx.user.id, planId, as);
    done();
    return {
      ok: true,
      message: r.signed
        ? "Plan firmado por ambas partes."
        : "Firma registrada. Falta la otra parte.",
    };
  } catch (e) {
    return fail(e);
  }
}

export async function reopenAction(planId: string): Promise<FormState> {
  const ctx = await requirePermission("annual_plan", "approve");
  try {
    await reopenPlan(ctx.tenant.tenantId, ctx.user.id, planId);
    done();
    return { ok: true, message: "Plan reabierto; las firmas se limpiaron." };
  } catch (e) {
    return fail(e);
  }
}
