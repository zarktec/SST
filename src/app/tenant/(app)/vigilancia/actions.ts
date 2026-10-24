"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import {
  PveError,
  addActivity,
  addFollowup,
  closeCase,
  closeProgram,
  completeActivity,
  openCase,
  recordPsychosocial,
  saveProgram,
} from "@/modules/pve/service";

const known = (e: unknown) =>
  e instanceof PveError ||
  (e instanceof Error &&
    ["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code)));
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
const done = () => revalidatePath("/vigilancia", "layout");
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function programAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("medical", "create");
  try {
    await saveProgram(ctx.tenant.tenantId, ctx.user.id, Object.fromEntries(f));
    done();
    return { ok: true, message: "Programa creado." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function closeProgramAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("medical", "edit");
  await closeProgram(ctx.tenant.tenantId, ctx.user.id, id);
  done();
  return { ok: true, message: "Programa cerrado." };
}
export async function activityAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("medical", "create");
  try {
    await addActivity(ctx.tenant.tenantId, ctx.user.id, Object.fromEntries(f));
    done();
    return { ok: true, message: "Actividad programada." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function activityDoneAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("medical", "edit");
  try {
    await completeActivity(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), Object.fromEntries(f));
    done();
    return { ok: true, message: "Actividad registrada." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function caseAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("medical", "create");
  try {
    await openCase(ctx.tenant.tenantId, ctx.user.id, Object.fromEntries(f));
    done();
    return { ok: true, message: "Caso abierto." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function followupAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("medical", "edit");
  try {
    await addFollowup(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), Object.fromEntries(f));
    done();
    return { ok: true, message: "Seguimiento registrado." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function closeCaseAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("medical", "edit");
  try {
    await closeCase(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), str(f, "closedOn"));
    done();
    return { ok: true, message: "Caso cerrado." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function psychosocialAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("medical", "create");
  try {
    const r = await recordPsychosocial(ctx.tenant.tenantId, ctx.user.id, Object.fromEntries(f));
    done();
    return { ok: true, message: `Aplicación registrada. Próxima aplicación: ${r.nextDueOn}.` };
  } catch (e) {
    return fail(e, f);
  }
}
