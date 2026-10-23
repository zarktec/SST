"use server";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/core/auth/session";
import { formValues, zodFieldErrors, type FormState } from "@/lib/form-state";
import { entrySchema } from "@/modules/legal/rules";
import { LegalError, saveEntry } from "@/modules/legal/service";

export async function saveEntryAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requirePermission("legal_matrix", "edit");
  const raw = Object.fromEntries(f);
  const parsed = entrySchema.safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      fieldErrors: zodFieldErrors(parsed.error.issues),
      values: formValues(f),
    };
  try {
    await saveEntry(ctx.tenant.tenantId, ctx.user.id, raw as never);
    revalidatePath("/matriz-legal");
    return { ok: true, message: "Guardado." };
  } catch (e) {
    const known =
      e instanceof LegalError ||
      (e instanceof Error &&
        ["PLAN_LIMIT", "READ_ONLY"].includes(String((e as { code?: string }).code)));
    return {
      ok: false,
      message: known ? (e as Error).message : "No se pudo guardar.",
      values: formValues(f),
    };
  }
}
