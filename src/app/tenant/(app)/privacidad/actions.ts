"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { ZodError } from "zod";
import { requirePermission, requireTenantMember } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import {
  PrivacyError,
  acceptConsent,
  createRequest,
  resolveRequest,
} from "@/modules/privacy/service";

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
        message: e instanceof PrivacyError ? e.message : "No se pudo completar la acción.",
        values: f ? formValues(f) : undefined,
      };
const done = () => revalidatePath("/privacidad", "layout");

export async function consentAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requireTenantMember();
  const h = await headers();
  try {
    await acceptConsent(ctx.tenant.tenantId, ctx.user.id, Object.fromEntries(f), {
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent"),
    });
    done();
    revalidatePath("/", "layout");
    return { ok: true, message: "Autorización registrada." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function requestAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requireTenantMember();
  try {
    const r = await createRequest(
      ctx.tenant.tenantId,
      { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email },
      Object.fromEntries(f),
    );
    done();
    return {
      ok: true,
      message: `Solicitud radicada. La empresa debe responderte a más tardar el ${r.dueOn}.`,
    };
  } catch (e) {
    return fail(e, f);
  }
}
export async function resolveAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("company", "edit");
  try {
    await resolveRequest(
      ctx.tenant.tenantId,
      ctx.user.id,
      String(f.get("id")),
      Object.fromEntries(f),
    );
    done();
    return { ok: true, message: "Respuesta registrada." };
  } catch (e) {
    return fail(e, f);
  }
}
