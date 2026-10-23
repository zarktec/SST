"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import { hazardRowSchema } from "@/modules/hazards/rules";
import {
  HazardError,
  approveMatrix,
  createDraft,
  deleteRow,
  saveParticipation,
  saveRow,
} from "@/modules/hazards/service";

const known = (e: unknown) =>
  e instanceof HazardError ||
  (e instanceof Error &&
    ["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code)));
const fail = (e: unknown, f?: FormData): FormState => ({
  ok: false,
  message: known(e) ? (e as Error).message : "No se pudo completar la acción.",
  values: f ? formValues(f) : undefined,
});
const done = () => revalidatePath("/peligros");

export async function createDraftAction(
  reason: "initial" | "annual" | "serious_accident" | "change",
): Promise<FormState> {
  const ctx = await requirePermission("hazard_matrix", "create");
  try {
    await createDraft(ctx.tenant.tenantId, ctx.user.id, reason);
    done();
    return { ok: true, message: "Borrador creado." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveRowAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("hazard_matrix", "edit");
  const raw = Object.fromEntries(f);
  const parsed = hazardRowSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
      values: formValues(f),
    };
  try {
    await saveRow(
      ctx.tenant.tenantId,
      ctx.user.id,
      String(f.get("matrixId")),
      raw as never,
      String(f.get("rowId") ?? "") || undefined,
    );
    done();
    return { ok: true, message: "Peligro guardado y valorado." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function deleteRowAction(matrixId: string, rowId: string): Promise<FormState> {
  const ctx = await requirePermission("hazard_matrix", "edit");
  try {
    await deleteRow(ctx.tenant.tenantId, ctx.user.id, matrixId, rowId);
    done();
    return { ok: true, message: "Eliminado." };
  } catch (e) {
    return fail(e);
  }
}

export async function participationAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("hazard_matrix", "edit");
  try {
    await saveParticipation(
      ctx.tenant.tenantId,
      ctx.user.id,
      String(f.get("matrixId")),
      String(f.get("participation") ?? ""),
    );
    done();
    return { ok: true, message: "Participación guardada." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function approveAction(matrixId: string): Promise<FormState> {
  const ctx = await requirePermission("hazard_matrix", "approve");
  try {
    await approveMatrix(ctx.tenant.tenantId, ctx.user.id, matrixId);
    done();
    return { ok: true, message: "Matriz aprobada." };
  } catch (e) {
    return fail(e);
  }
}
