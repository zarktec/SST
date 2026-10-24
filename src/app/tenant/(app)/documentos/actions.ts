"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { ZodError } from "zod";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import {
  DocumentError,
  approveVersion,
  createDocument,
  masterList,
  saveDraft,
} from "@/modules/documents/service";

const known = (e: unknown) =>
  e instanceof DocumentError ||
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
const done = () => revalidatePath("/documentos", "layout");
const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function createDocumentAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("documents", "create");
  try {
    await createDocument(
      ctx.tenant.tenantId,
      ctx.user.id,
      ctx.user.name || ctx.user.email,
      Object.fromEntries(f),
    );
    done();
    return { ok: true, message: "Documento creado como borrador." };
  } catch (e) {
    return fail(e, f);
  }
}
export async function draftAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("documents", "edit");
  try {
    const r = await saveDraft(
      ctx.tenant.tenantId,
      ctx.user.id,
      ctx.user.name || ctx.user.email,
      str(f, "id"),
      Object.fromEntries(f),
    );
    done();
    return {
      ok: true,
      message: r.created ? `Nueva versión ${r.version} en borrador.` : "Borrador guardado.",
    };
  } catch (e) {
    return fail(e, f);
  }
}
export async function approveAction(_p: FormState, f: FormData): Promise<FormState> {
  // La política de SST la aprueba la alta dirección (permiso `policy`); los demás documentos, quien tenga `documents:approve`.
  const docId = str(f, "documentId");
  const doc = (
    await masterList((await requirePermission("documents", "view")).tenant.tenantId)
  ).find((d) => d.id === docId);
  const ctx = await requirePermission(doc?.kind === "policy" ? "policy" : "documents", "approve");
  const h = await headers();
  try {
    await approveVersion(
      ctx.tenant.tenantId,
      ctx.user.id,
      ctx.user.name || ctx.user.email,
      str(f, "id"),
      str(f, "signature"),
      Object.fromEntries(f),
      {
        ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: h.get("user-agent"),
      },
    );
    done();
    return { ok: true, message: "Versión aprobada y vigente." };
  } catch (e) {
    return fail(e, f);
  }
}
