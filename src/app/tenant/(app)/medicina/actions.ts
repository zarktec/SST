"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import { absenceSchema, resultSchema, scheduleSchema } from "@/modules/medical/rules";
import {
  MedicalError,
  addAbsence,
  closeAbsence,
  completeAdaptation,
  recordResult,
  scheduleEvaluation,
  sendProfileToIps,
} from "@/modules/medical/service";

const known = (e: unknown) =>
  e instanceof MedicalError ||
  (e instanceof Error &&
    (["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code)) ||
      /discriminatorio/.test(e.message)));
const fail = (e: unknown, f?: FormData): NonNullable<FormState> => ({
  ok: false,
  message: known(e) ? (e as Error).message : "No se pudo completar la acción.",
  values: f ? formValues(f) : undefined,
});
const invalid = (
  f: FormData,
  issues: Parameters<typeof zodFieldErrors>[0],
): NonNullable<FormState> => ({
  ok: false,
  message: "Revisa los campos marcados.",
  fieldErrors: zodFieldErrors(issues),
  values: formValues(f),
});
const done = () => revalidatePath("/medicina", "layout");

export async function scheduleAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("medical", "create");
  const raw = Object.fromEntries(f);
  const parsed = scheduleSchema.safeParse(raw);
  if (!parsed.success) return invalid(f, parsed.error.issues);
  try {
    await scheduleEvaluation(ctx.tenant.tenantId, ctx.user.id, raw as never);
    done();
    return { ok: true, message: "Evaluación programada." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function resultAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("medical", "edit");
  const raw = Object.fromEntries(f);
  const parsed = resultSchema.safeParse(raw);
  if (!parsed.success) return invalid(f, parsed.error.issues);
  try {
    const r = await recordResult(ctx.tenant.tenantId, ctx.user.id, raw as never);
    done();
    return {
      ok: true,
      message: r.taskDue
        ? `Resultado registrado. Se creó la tarea de adaptación del puesto (plazo ${r.taskDue}).`
        : "Resultado registrado.",
    };
  } catch (e) {
    return fail(e, f);
  }
}

export async function adaptationAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("medical", "edit");
  try {
    await completeAdaptation(
      ctx.tenant.tenantId,
      ctx.user.id,
      String(f.get("id")),
      String(f.get("note") ?? ""),
    );
    done();
    return { ok: true, message: "Adaptación registrada." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function sendIpsAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("medical", "edit");
  try {
    await sendProfileToIps(
      ctx.tenant.tenantId,
      ctx.user.id,
      String(f.get("id")),
      String(f.get("email") ?? ""),
    );
    return { ok: true, message: "Perfil enviado a la IPS." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function absenceAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("medical", "create");
  const raw = Object.fromEntries(f);
  const parsed = absenceSchema.safeParse(raw);
  if (!parsed.success) return invalid(f, parsed.error.issues);
  try {
    await addAbsence(ctx.tenant.tenantId, ctx.user.id, raw as never);
    done();
    return { ok: true, message: "Ausencia registrada." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function closeAbsenceAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("medical", "edit");
  try {
    await closeAbsence(
      ctx.tenant.tenantId,
      ctx.user.id,
      String(f.get("id")),
      String(f.get("endDate")),
    );
    done();
    return { ok: true, message: "Ausencia cerrada." };
  } catch (e) {
    return fail(e, f);
  }
}
