"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, requireTenantMember } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import { complaintSchema, STAGES, type Stage } from "@/modules/convivencia/rules";
import {
  AccessDeniedError,
  ConvivenciaError,
  advanceComplaint,
  signConfidentiality,
  submitComplaint,
} from "@/modules/convivencia/service";

const known = (e: unknown) =>
  e instanceof ConvivenciaError ||
  e instanceof AccessDeniedError ||
  (e instanceof Error &&
    ["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code)));
const fail = (e: unknown, f?: FormData): NonNullable<FormState> => ({
  ok: false,
  message: known(e) ? (e as Error).message : "No se pudo completar la acción.",
  values: f ? formValues(f) : undefined,
});

/** Radicar una queja: cualquier persona autenticada de la empresa (sin permiso especial); puede ser anónima. */
export async function submitComplaintAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requireTenantMember();
  const raw = Object.fromEntries(f);
  const parsed = complaintSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
      values: formValues(f),
    };
  try {
    const r = await submitComplaint(ctx.tenant.tenantId, ctx.user.email, raw as never);
    return {
      ok: true,
      message: r.assignedToCommittee
        ? "Tu queja fue recibida de forma confidencial por el Comité de Convivencia."
        : "Tu queja fue recibida de forma confidencial. Aún no hay comité conformado: la empresa debe hacerlo para darle trámite.",
    };
  } catch (e) {
    return fail(e, f);
  }
}

export async function signConfidentialityAction(signature: string): Promise<FormState> {
  const ctx = await requirePermission("ccl", "view");
  try {
    await signConfidentiality(
      ctx.tenant.tenantId,
      { userId: ctx.user.id, email: ctx.user.email },
      signature,
    );
    revalidatePath("/convivencia");
    return { ok: true, message: "Acuerdo de confidencialidad firmado." };
  } catch (e) {
    return fail(e);
  }
}

export async function advanceAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("ccl", "edit");
  const stage = String(f.get("stage")) as Stage;
  if (!STAGES.includes(stage)) return { ok: false, message: "Etapa inválida" };
  try {
    await advanceComplaint(
      ctx.tenant.tenantId,
      { userId: ctx.user.id, email: ctx.user.email },
      String(f.get("id")),
      stage,
      String(f.get("note") ?? ""),
    );
    revalidatePath("/convivencia", "layout");
    return { ok: true, message: "Trámite actualizado." };
  } catch (e) {
    return fail(e, f);
  }
}
