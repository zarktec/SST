"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { formValues, type FormState } from "@/lib/form-state";
import {
  AssessmentError,
  closeAssessment,
  registerWithMinistry,
  setItem,
  startAssessment,
  updateImprovement,
} from "@/modules/assessment/service";
import type { ItemStatus } from "@/modules/assessment/rules";

const known = (e: unknown) =>
  e instanceof AssessmentError ||
  (e instanceof Error &&
    ["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code)));
const fail = (e: unknown, f?: FormData): FormState => ({
  ok: false,
  message: known(e) ? (e as Error).message : "No se pudo guardar. Intenta de nuevo.",
  values: f ? formValues(f) : undefined,
});
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function startAssessmentAction(
  year: number,
): Promise<{ ok: boolean; message: string; id?: string }> {
  const ctx = await requirePermission("standards", "create");
  try {
    const id = await startAssessment(ctx.tenant.tenantId, ctx.user.id, year);
    revalidatePath("/estandares");
    return { ok: true, message: "Autoevaluación iniciada.", id };
  } catch (e) {
    return { ok: false, message: fail(e)!.message };
  }
}

export async function setItemAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("standards", "edit");
  try {
    await setItem(ctx.tenant.tenantId, ctx.user.id, str(f, "assessmentId"), str(f, "itemCode"), {
      status: str(f, "status") as ItemStatus,
      justification: str(f, "justification"),
      responsibleName: str(f, "responsibleName"),
      observations: str(f, "observations"),
      evidence: str(f, "evidence"),
    });
    revalidatePath(`/estandares/${str(f, "assessmentId")}`);
    return { ok: true, message: "Guardado." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function closeAssessmentAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("standards", "approve");
  try {
    const r = await closeAssessment(ctx.tenant.tenantId, ctx.user.id, id);
    revalidatePath(`/estandares/${id}`);
    revalidatePath("/estandares");
    return {
      ok: true,
      message: `Cerrada: ${r.pct}% (${r.level ?? "sin rango"}). Acciones de mejoramiento generadas: ${r.improvements}.`,
    };
  } catch (e) {
    return fail(e);
  }
}

export async function registerMinistryAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("standards", "approve");
  try {
    await registerWithMinistry(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), str(f, "date"));
    revalidatePath(`/estandares/${str(f, "id")}`);
    return { ok: true, message: "Registro ante el Ministerio guardado." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function updateImprovementAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("standards", "edit");
  try {
    await updateImprovement(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), {
      responsibleName: str(f, "responsibleName"),
      dueDate: str(f, "dueDate"),
      status: str(f, "status") as "open" | "in_progress" | "done",
      closureNote: str(f, "closureNote"),
    });
    revalidatePath("/estandares/plan");
    return { ok: true, message: "Acción actualizada." };
  } catch (e) {
    return fail(e, f);
  }
}
