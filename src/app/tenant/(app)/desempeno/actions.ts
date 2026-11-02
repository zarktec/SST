"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import {
  PerformanceError,
  addAssignment,
  addSubject,
  closeCycle,
  createCycle,
  removeAssignment,
  saveSettings,
  submitResponse,
} from "@/modules/performance/service";

const known = (e: unknown) =>
  e instanceof PerformanceError ||
  (e instanceof Error &&
    ["PLAN_LIMIT", "READ_ONLY", "MODULE_DISABLED"].includes(String((e as { code?: string }).code)));
const fail = (e: unknown, f?: FormData): NonNullable<FormState> =>
  e instanceof ZodError
    ? {
        ok: false,
        message: "Revisa los campos marcados.",
        fieldErrors: zodFieldErrors(e.issues),
        values: f ? formValues(f) : undefined,
      }
    : {
        ok: false,
        message: known(e) ? (e as Error).message : "No se pudo completar la acción.",
        values: f ? formValues(f) : undefined,
      };
const done = () => revalidatePath("/desempeno", "layout");
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function settingsAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("performance", "edit");
  try {
    await saveSettings(ctx.tenant.tenantId, ctx.user.id, f.get("anonymous") === "on");
    done();
    return { ok: true, message: "Configuración guardada. Aplica a los ciclos nuevos." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function cycleAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("performance", "create");
  try {
    await createCycle(ctx.tenant.tenantId, ctx.user.id, Object.fromEntries(f));
    done();
    return { ok: true, message: "Ciclo creado. Ahora agrega a las personas a evaluar." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function subjectAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("performance", "edit");
  try {
    await addSubject(ctx.tenant.tenantId, ctx.user.id, Object.fromEntries(f));
    done();
    return { ok: true, message: "Persona agregada al ciclo." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function assignmentAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("performance", "edit");
  try {
    await addAssignment(ctx.tenant.tenantId, ctx.user.id, Object.fromEntries(f));
    done();
    return { ok: true, message: "Evaluador asignado." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function removeAssignmentAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("performance", "edit");
  try {
    await removeAssignment(ctx.tenant.tenantId, ctx.user.id, id);
    done();
    return { ok: true, message: "Asignación quitada." };
  } catch (e) {
    return fail(e);
  }
}

export async function closeCycleAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("performance", "approve");
  try {
    await closeCycle(ctx.tenant.tenantId, ctx.user.id, id);
    done();
    return { ok: true, message: "Ciclo cerrado." };
  } catch (e) {
    return fail(e);
  }
}

/** Cualquier persona con acceso al módulo responde SUS evaluaciones: el servicio verifica que la asignación sea suya. */
export async function submitAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("performance", "view");
  try {
    const ratings: Record<string, string> = {};
    for (const [k, v] of f.entries())
      if (k.startsWith("r_") && typeof v === "string") ratings[k.slice(2)] = v;
    await submitResponse(
      ctx.tenant.tenantId,
      ctx.user.id,
      ctx.user.email,
      str(f, "assignmentId"),
      ratings,
      str(f, "comment"),
    );
    done();
    return { ok: true, message: "Evaluación enviada. ¡Gracias!" };
  } catch (e) {
    return fail(e, f);
  }
}
