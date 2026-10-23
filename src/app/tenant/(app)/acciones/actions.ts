"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import { STATUS_LABEL, actionSchema, type Status } from "@/modules/capa/rules";
import {
  CapaError,
  createAction,
  moveAction,
  updateAction,
  verifyEffectiveness,
} from "@/modules/capa/service";

const known = (e: unknown) =>
  e instanceof CapaError ||
  (e instanceof Error &&
    ["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code)));
const fail = (e: unknown, f?: FormData): NonNullable<FormState> => ({
  ok: false,
  message: known(e) ? (e as Error).message : "No se pudo completar la acción.",
  values: f ? formValues(f) : undefined,
});
const done = () => revalidatePath("/acciones", "layout");

export async function createActionAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("actions", "create");
  const raw = Object.fromEntries(f);
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
      values: formValues(f),
    };
  try {
    await createAction(ctx.tenant.tenantId, ctx.user.id, raw as never);
    done();
    return { ok: true, message: "Acción creada." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function updateActionAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("actions", "edit");
  try {
    await updateAction(ctx.tenant.tenantId, ctx.user.id, String(f.get("id")), {
      rootCause: String(f.get("rootCause") ?? ""),
      responsibleName: String(f.get("responsibleName") ?? ""),
      dueDate: String(f.get("dueDate") ?? ""),
    });
    done();
    return { ok: true, message: "Acción actualizada." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function moveActionAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("actions", "edit");
  const to = String(f.get("to")) as Status;
  if (!(to in STATUS_LABEL)) return { ok: false, message: "Estado inválido" };
  try {
    await moveAction(
      ctx.tenant.tenantId,
      ctx.user.id,
      String(f.get("id")),
      to,
      String(f.get("note") ?? ""),
    );
    done();
    return { ok: true, message: "Estado actualizado." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function verifyAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("actions", "approve");
  try {
    const r = await verifyEffectiveness(ctx.tenant.tenantId, ctx.user.id, String(f.get("id")), {
      effective: String(f.get("effective")),
      note: String(f.get("note") ?? ""),
    });
    done();
    return {
      ok: true,
      message: r.followUpId
        ? "Verificada: no fue eficaz, se abrió una nueva acción."
        : "Verificada como eficaz.",
    };
  } catch (e) {
    return fail(e, f);
  }
}
