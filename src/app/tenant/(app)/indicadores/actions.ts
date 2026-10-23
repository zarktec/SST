"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { formValues, type FormState } from "@/lib/form-state";
import type { Periodicity } from "@/modules/indicators/rules";
import { IndicatorError, saveAnalysis, saveTarget } from "@/modules/indicators/service";

const known = (e: unknown) =>
  e instanceof IndicatorError ||
  (e instanceof Error &&
    ["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code)));
const fail = (e: unknown, f?: FormData): NonNullable<FormState> => ({
  ok: false,
  message: known(e) ? (e as Error).message : "No se pudo completar la acción.",
  values: f ? formValues(f) : undefined,
});
const PERIODICITIES = ["mensual", "trimestral", "semestral", "anual"];

export async function targetAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("indicators", "edit");
  const raw = String(f.get("target") ?? "")
    .trim()
    .replace(",", ".");
  try {
    await saveTarget(
      ctx.tenant.tenantId,
      ctx.user.id,
      String(f.get("code")),
      raw === "" ? null : Number(raw),
    );
    revalidatePath("/indicadores");
    return { ok: true, message: raw === "" ? "Meta propia eliminada." : "Meta guardada." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function analysisAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("indicators", "edit");
  const periodicity = String(f.get("periodicity"));
  if (!PERIODICITIES.includes(periodicity)) return { ok: false, message: "Periodicidad inválida" };
  try {
    await saveAnalysis(
      ctx.tenant.tenantId,
      ctx.user.id,
      String(f.get("code")),
      periodicity as Periodicity,
      String(f.get("from")),
      String(f.get("analysis") ?? ""),
    );
    revalidatePath("/indicadores");
    return { ok: true, message: "Análisis guardado." };
  } catch (e) {
    return fail(e, f);
  }
}
