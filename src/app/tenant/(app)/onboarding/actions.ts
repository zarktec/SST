"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import { companyDataSchema, responsibleSchema, workCenterSchema } from "@/modules/company/rules";
import {
  CompanyError,
  completeOnboarding,
  removeWorkCenter,
  resolveAlert,
  saveBrandColors,
  saveCompanyData,
  saveResponsible,
  saveWorkCenter,
} from "@/modules/company/service";

const done = () => revalidatePath("/onboarding");
const invalid = (f: FormData, issues: Parameters<typeof zodFieldErrors>[0]): FormState => ({
  ok: false,
  message: "Revisa los campos marcados.",
  fieldErrors: zodFieldErrors(issues),
  values: formValues(f),
});
const failure = (e: unknown, f: FormData): FormState => ({
  ok: false,
  message: e instanceof CompanyError ? e.message : "No se pudo guardar. Intenta de nuevo.",
  values: formValues(f),
});

export async function saveCompanyAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("company", "edit");
  const raw = Object.fromEntries(f);
  const parsed = companyDataSchema.safeParse(raw);
  if (!parsed.success) return invalid(f, parsed.error.issues);
  const group = await saveCompanyData(ctx.tenant.tenantId, ctx.user.id, raw as never);
  done();
  return {
    ok: true,
    message: group
      ? `Datos guardados. Te aplican ${group} estándares mínimos.`
      : "Datos guardados, pero no se pudo clasificar: revisa el número de trabajadores y la clase de riesgo.",
  };
}

export async function saveCenterAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("company", "edit");
  const raw = Object.fromEntries(f);
  const parsed = workCenterSchema.safeParse(raw);
  if (!parsed.success) return invalid(f, parsed.error.issues);
  try {
    await saveWorkCenter(
      ctx.tenant.tenantId,
      ctx.user.id,
      raw as never,
      String(f.get("id") ?? "") || undefined,
    );
    done();
    return { ok: true, message: "Sede guardada." };
  } catch (e) {
    return failure(e, f);
  }
}

export async function removeCenterAction(id: string) {
  const ctx = await requirePermission("company", "delete");
  await removeWorkCenter(ctx.tenant.tenantId, ctx.user.id, id);
  done();
}

export async function saveResponsibleAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("company", "edit");
  const raw = Object.fromEntries(f);
  const parsed = responsibleSchema.safeParse(raw);
  if (!parsed.success) return invalid(f, parsed.error.issues);
  await saveResponsible(ctx.tenant.tenantId, ctx.user.id, raw as never);
  done();
  return { ok: true, message: "Responsable del SG-SST guardado." };
}

export async function saveBrandAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("company", "edit");
  try {
    await saveBrandColors(ctx.tenant.tenantId, ctx.user.id, {
      primary: String(f.get("primary")),
      secondary: String(f.get("secondary")),
      accent: String(f.get("accent")),
    });
    done();
    return { ok: true, message: "Colores guardados." };
  } catch (e) {
    return failure(e, f);
  }
}

export async function completeOnboardingAction(): Promise<FormState> {
  const ctx = await requirePermission("company", "edit");
  try {
    await completeOnboarding(ctx.tenant.tenantId, ctx.user.id);
    revalidatePath("/");
    return { ok: true, message: "Onboarding completado." };
  } catch (e) {
    return failure(e, new FormData());
  }
}

export async function resolveAlertAction(id: string) {
  const ctx = await requirePermission("company", "edit");
  await resolveAlert(ctx.tenant.tenantId, ctx.user.id, id);
  revalidatePath("/");
}
