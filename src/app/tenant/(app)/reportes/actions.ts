"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import { reportSchema, reviewSchema } from "@/modules/unsafe-reports/rules";
import { UnsafeReportError, createReport, reviewReport } from "@/modules/unsafe-reports/service";

const known = (e: unknown) =>
  e instanceof UnsafeReportError ||
  (e instanceof Error &&
    ["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code)));
const fail = (e: unknown, f?: FormData): NonNullable<FormState> => ({
  ok: false,
  message: known(e) ? (e as Error).message : "No se pudo completar la acción.",
  values: f ? formValues(f) : undefined,
});
const done = () => revalidatePath("/reportes", "layout");

export async function reportAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("unsafe_reports", "create");
  const raw = Object.fromEntries(f);
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
      values: formValues(f),
    };
  try {
    await createReport(ctx.tenant.tenantId, ctx.user.id, raw as never);
    done();
    return { ok: true, message: "Gracias, tu reporte fue enviado." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function reviewAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("unsafe_reports", "edit");
  const raw = Object.fromEntries(f);
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
      values: formValues(f),
    };
  try {
    await reviewReport(ctx.tenant.tenantId, ctx.user.id, String(f.get("id")), parsed.data);
    done();
    return { ok: true, message: "Reporte revisado." };
  } catch (e) {
    return fail(e, f);
  }
}
