"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformStaff } from "@/core/auth/session";
import { withPlatform } from "@/core/db";
import { PLAN_MODULE_KEYS } from "@/core/plans/modules";
import { couponInputSchema, planInputSchema } from "@/modules/platform/plans/schema";
import {
  archivePlan,
  createCoupon,
  createPlan,
  setCouponActive,
  updatePlan,
} from "@/modules/platform/plans/service";

export type FormState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
} | null;

const num = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? "")
    .trim()
    .replace(/[.\s$]/g, "")
    .replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};
const bool = (f: FormData, name: string) => f.get(name) === "on";
const str = (f: FormData, name: string) => String(f.get(name) ?? "");

async function guard(action: string, detail?: Record<string, unknown>) {
  const staff = await requirePlatformStaff({ allow: ["SUPER_ADMIN"] });
  await withPlatform(
    { actorId: staff.user.id, action, reason: detail ? JSON.stringify(detail) : undefined },
    async () => undefined,
  );
  return staff;
}

function planFromForm(f: FormData, fixedKey?: string) {
  return planInputSchema.safeParse({
    key: fixedKey ?? str(f, "key"),
    name: str(f, "name"),
    description: str(f, "description"),
    isTrial: bool(f, "isTrial"),
    trialDays: num(f.get("trialDays")),
    vatEnabled: bool(f, "vatEnabled"),
    vatIncluded: bool(f, "vatIncluded"),
    vatRatePercent: num(f.get("vatRatePercent")) ?? 0,
    limits: {
      workers: num(f.get("limitWorkers")),
      users: num(f.get("limitUsers")),
      centers: num(f.get("limitCenters")),
      storageMb: num(f.get("limitStorageMb")),
    },
    modules: PLAN_MODULE_KEYS.filter((k) => f.get(`module_${k}`) === "on"),
    visible: bool(f, "visible"),
    sortOrder: num(f.get("sortOrder")) ?? 0,
    active: bool(f, "active"),
    monthlyPesos: num(f.get("monthlyPesos")),
    annualPesos: num(f.get("annualPesos")),
    monthlySiigoCode: str(f, "monthlySiigoCode").trim() || null,
    annualSiigoCode: str(f, "annualSiigoCode").trim() || null,
  });
}

function errorsOf(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const i of issues) fieldErrors[String(i.path[0] ?? "form")] ??= i.message;
  return {
    ok: false,
    message: Object.values(fieldErrors)[0] ?? "Revisa el formulario",
    fieldErrors,
  } as const;
}

export async function createPlanAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = planFromForm(form);
  if (!parsed.success) return errorsOf(parsed.error.issues);
  await guard("plan.create", { key: parsed.data.key });
  let id: string;
  try {
    id = await createPlan(parsed.data);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "No se pudo crear el plan" };
  }
  revalidatePath("/planes");
  redirect(`/planes/${id}`);
}

export async function updatePlanAction(
  id: string,
  key: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const parsed = planFromForm(form, key);
  if (!parsed.success) return errorsOf(parsed.error.issues);
  await guard("plan.update", { id });
  try {
    await updatePlan(id, parsed.data);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "No se pudo guardar" };
  }
  revalidatePath("/planes");
  return {
    ok: true,
    message:
      "Plan guardado. Los cambios de precio aplican a las suscripciones en su próxima renovación.",
  };
}

export async function archivePlanAction(id: string): Promise<void> {
  await guard("plan.archive", { id });
  await archivePlan(id);
  revalidatePath("/planes");
  redirect("/planes");
}

export async function createCouponAction(_prev: FormState, form: FormData): Promise<FormState> {
  const date = (n: string, end = false) => {
    const v = str(form, n);
    return v ? new Date(`${v}T${end ? "23:59:59" : "00:00:00"}-05:00`) : null;
  };
  const parsed = couponInputSchema.safeParse({
    code: str(form, "code"),
    description: str(form, "description"),
    kind: str(form, "kind"),
    value: num(form.get("value")) ?? 0,
    validFrom: date("validFrom"),
    validTo: date("validTo", true),
    maxUses: num(form.get("maxUses")),
    planIds: form.getAll("planIds").map(String),
    active: true,
  });
  if (!parsed.success) return errorsOf(parsed.error.issues);
  await guard("coupon.create", { code: parsed.data.code });
  try {
    await createCoupon(parsed.data);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "No se pudo crear el cupón" };
  }
  revalidatePath("/cupones");
  return { ok: true, message: `Cupón ${parsed.data.code} creado.` };
}

export async function toggleCouponAction(id: string, active: boolean): Promise<void> {
  await guard("coupon.toggle", { id, active });
  await setCouponActive(id, active);
  revalidatePath("/cupones");
}
