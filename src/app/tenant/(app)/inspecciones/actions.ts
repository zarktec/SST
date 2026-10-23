"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import { templateSchema } from "@/modules/inspections/rules";
import {
  InspectionError,
  importCatalogTemplate,
  saveTemplate,
  setTemplateActive,
} from "@/modules/inspections/service";

const known = (e: unknown) =>
  e instanceof InspectionError ||
  (e instanceof Error &&
    ["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code)));
const fail = (e: unknown, f?: FormData): NonNullable<FormState> => ({
  ok: false,
  message: known(e) ? (e as Error).message : "No se pudo completar la acción.",
  values: f ? formValues(f) : undefined,
});
const done = () => revalidatePath("/inspecciones", "layout");

export async function templateAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("inspections", "edit");
  const raw = Object.fromEntries(f);
  const parsed = templateSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
      values: formValues(f),
    };
  try {
    await saveTemplate(
      ctx.tenant.tenantId,
      ctx.user.id,
      parsed.data,
      String(f.get("id") ?? "") || undefined,
    );
    done();
    return { ok: true, message: "Plantilla guardada." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function toggleTemplateAction(id: string, active: boolean): Promise<FormState> {
  const ctx = await requirePermission("inspections", "edit");
  try {
    await setTemplateActive(ctx.tenant.tenantId, id, active);
    done();
    return { ok: true, message: active ? "Plantilla activada." : "Plantilla desactivada." };
  } catch (e) {
    return fail(e);
  }
}

export async function importTemplateAction(code: string): Promise<FormState> {
  const ctx = await requirePermission("inspections", "edit");
  try {
    await importCatalogTemplate(ctx.tenant.tenantId, ctx.user.id, code);
    done();
    return { ok: true, message: "Plantilla importada." };
  } catch (e) {
    return fail(e);
  }
}
