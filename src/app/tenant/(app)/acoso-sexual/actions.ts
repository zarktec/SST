"use server";
import { revalidatePath } from "next/cache";
import { requirePermission, requireTenantMember } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import { harassmentSchema } from "@/modules/convivencia/rules";
import {
  ConvivenciaError,
  submitHarassmentReport,
  updateHarassmentReport,
} from "@/modules/convivencia/service";

/** Cualquier persona autenticada puede reportar (también de forma anónima). */
export async function submitHarassmentAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requireTenantMember();
  const raw = Object.fromEntries(f);
  const parsed = harassmentSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
      values: formValues(f),
    };
  try {
    await submitHarassmentReport(ctx.tenant.tenantId, ctx.user.email, raw as never);
    return {
      ok: true,
      message:
        "Tu reporte fue recibido de forma confidencial por la alta dirección. No lo recibe el Comité de Convivencia.",
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof ConvivenciaError ? e.message : "No se pudo registrar el reporte.",
      values: formValues(f),
    };
  }
}

export async function updateHarassmentAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("harassment", "edit");
  const status = String(f.get("status"));
  if (!["in_review", "referred", "closed"].includes(status))
    return { ok: false, message: "Estado inválido" };
  try {
    await updateHarassmentReport(
      ctx.tenant.tenantId,
      { userId: ctx.user.id, email: ctx.user.email },
      String(f.get("id")),
      status as "in_review" | "referred" | "closed",
      String(f.get("note") ?? ""),
    );
    revalidatePath("/acoso-sexual", "layout");
    return { ok: true, message: "Reporte actualizado." };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof ConvivenciaError ? e.message : "No se pudo actualizar.",
      values: formValues(f),
    };
  }
}
