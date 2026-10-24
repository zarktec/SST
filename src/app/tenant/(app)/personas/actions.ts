"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import { workerSchema } from "@/modules/workers/rules";
import {
  WorkerError,
  createWorker,
  importWorkers,
  recordSsCheck,
  retireWorker,
  updateWorker,
} from "@/modules/workers/service";

const known = (e: unknown) =>
  e instanceof WorkerError ||
  (e instanceof Error &&
    ["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code)));
const fail = (e: unknown, f: FormData): FormState => ({
  ok: false,
  message: known(e) ? (e as Error).message : "No se pudo guardar. Intenta de nuevo.",
  values: formValues(f),
});

/** Crea (sin `id`) o actualiza (con `id`) a una persona. Devuelve `savedId` en el mensaje de éxito vía revalidación. */
export async function saveWorkerAction(_p: FormState, f: FormData): Promise<FormState> {
  const id = String(f.get("id") ?? "");
  const ctx = await requirePermission("workers", id ? "edit" : "create");
  const raw = Object.fromEntries(f);
  const parsed = workerSchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
      values: formValues(f),
    };
  try {
    if (id) await updateWorker(ctx.tenant.tenantId, ctx.user.id, id, raw as never);
    else await createWorker(ctx.tenant.tenantId, ctx.user.id, raw as never);
    revalidatePath("/personas");
    return { ok: true, message: id ? "Cambios guardados." : "Persona registrada." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function retireWorkerAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("workers", "edit");
  try {
    await retireWorker(
      ctx.tenant.tenantId,
      ctx.user.id,
      String(f.get("id")),
      String(f.get("endDate")),
    );
    revalidatePath("/personas");
    return { ok: true, message: "Retiro registrado." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function ssCheckAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("workers", "edit");
  try {
    await recordSsCheck(ctx.tenant.tenantId, ctx.user.id, String(f.get("id")), {
      period: String(f.get("period")),
      paid: f.get("paid") === "yes",
      note: String(f.get("note") ?? ""),
    });
    revalidatePath("/personas");
    return { ok: true, message: "Verificación registrada." };
  } catch (e) {
    return fail(e, f);
  }
}

export async function importWorkersAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("workers", "create");
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, message: "Selecciona un archivo CSV." };
  if (file.size > 2_000_000) return { ok: false, message: "El archivo supera 2 MB." };
  try {
    const r = await importWorkers(ctx.tenant.tenantId, ctx.user.id, await file.text());
    revalidatePath("/personas");
    return {
      ok: r.imported > 0 || r.errors.length === 0,
      message: `Importadas: ${r.imported}. Omitidas: ${r.skipped.length}. Con error: ${r.errors.length}.`,
      details: [...r.skipped, ...r.errors].map((e) => `Fila ${e.row}: ${e.message}`),
      keepOpen: r.skipped.length + r.errors.length > 0,
    };
  } catch (e) {
    return fail(e, f);
  }
}
