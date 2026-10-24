"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import { PICTOGRAMS } from "@/modules/chemicals/rules";
import {
  ChemicalError,
  retireSubstance,
  saveSubstance,
  updateCompliance,
} from "@/modules/chemicals/service";

const known = (e: unknown) =>
  e instanceof ChemicalError ||
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
const done = () => revalidatePath("/quimicos", "layout");
const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const withPictograms = (f: FormData) => ({
  ...Object.fromEntries(f),
  pictograms: PICTOGRAMS.filter((p) => f.get(`p_${p.value}`) === "on").map((p) => p.value),
});

export async function substanceAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("chemicals", str(f, "id") ? "edit" : "create");
  try {
    await saveSubstance(
      ctx.tenant.tenantId,
      ctx.user.id,
      withPictograms(f),
      str(f, "id") || undefined,
    );
    done();
    return { ok: true, message: "Sustancia guardada." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function complianceAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("chemicals", "edit");
  try {
    await updateCompliance(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), {
      sdsRevisedOn: str(f, "sdsRevisedOn") || undefined,
      labelCheckedOn: str(f, "labelCheckedOn") || undefined,
    });
    done();
    return { ok: true, message: "Registro actualizado." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function retireAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("chemicals", "edit");
  await retireSubstance(ctx.tenant.tenantId, ctx.user.id, id);
  done();
  return { ok: true, message: "Sustancia retirada." };
}
