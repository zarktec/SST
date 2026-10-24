"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import {
  AuditError,
  cancelAudit,
  closeAudit,
  createAudit,
  saveAudit,
} from "@/modules/audits/service";

const known = (e: unknown) =>
  e instanceof AuditError ||
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
const done = () => revalidatePath("/auditorias", "layout");
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function createAuditAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("audits", "create");
  try {
    await createAudit(ctx.tenant.tenantId, ctx.user.id, Object.fromEntries(f));
    done();
    return { ok: true, message: "Auditoría programada." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function saveAuditAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("audits", "edit");
  try {
    const results: Record<string, { result?: string; note?: string }> = {};
    for (const [k, v] of f.entries()) {
      if (k.startsWith("r_")) (results[k.slice(2)] ??= {}).result = String(v);
      if (k.startsWith("n_")) (results[k.slice(2)] ??= {}).note = String(v);
    }
    await saveAudit(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), Object.fromEntries(f), results);
    done();
    return { ok: true, message: "Avance guardado." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function closeAuditAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("audits", "approve");
  try {
    const r = await closeAudit(ctx.tenant.tenantId, ctx.user.id, id);
    done();
    return {
      ok: true,
      message: `Auditoría cerrada. Hallazgos convertidos en acciones: ${r.findings}.`,
    };
  } catch (e) {
    return fail(e);
  }
}
export async function cancelAuditAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("audits", "edit");
  await cancelAudit(ctx.tenant.tenantId, ctx.user.id, id);
  done();
  return { ok: true, message: "Auditoría cancelada." };
}
