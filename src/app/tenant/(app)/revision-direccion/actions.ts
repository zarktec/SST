"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { ZodError } from "zod";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import {
  AuditError,
  createReview,
  refreshReviewInputs,
  saveReview,
  signReview,
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
const done = () => revalidatePath("/revision-direccion", "layout");
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function createReviewAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("management_review", "create");
  try {
    const year = Number(str(f, "year")) || new Date().getUTCFullYear();
    await createReview(ctx.tenant.tenantId, ctx.user.id, year, Object.fromEntries(f));
    done();
    return { ok: true, message: "Revisión creada con las entradas del sistema." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function saveReviewAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("management_review", "edit");
  try {
    await saveReview(ctx.tenant.tenantId, ctx.user.id, str(f, "id"), Object.fromEntries(f));
    done();
    return { ok: true, message: "Revisión guardada." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function refreshInputsAction(id: string): Promise<FormState> {
  const ctx = await requirePermission("management_review", "edit");
  try {
    await refreshReviewInputs(ctx.tenant.tenantId, ctx.user.id, id);
    done();
    return { ok: true, message: "Entradas actualizadas." };
  } catch (e) {
    return fail(e);
  }
}
export async function signReviewAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("management_review", "approve");
  const h = await headers();
  try {
    await signReview(
      ctx.tenant.tenantId,
      ctx.user.id,
      ctx.user.name || ctx.user.email,
      str(f, "id"),
      str(f, "signature"),
      { name: str(f, "responsibleName"), dueDate: str(f, "dueDate") },
      {
        ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: h.get("user-agent"),
      },
    );
    done();
    return { ok: true, message: "Revisión firmada." };
  } catch (e) {
    return fail(e, f);
  }
}
