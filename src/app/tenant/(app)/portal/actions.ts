"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireTenantMember } from "@/core/auth/session";
import type { FormState } from "@/lib/form-state";
import { DocumentError, acknowledge } from "@/modules/documents/service";

export async function acknowledgePolicyAction(versionId: string): Promise<FormState> {
  const ctx = await requireTenantMember();
  try {
    const h = await headers();
    await acknowledge(
      ctx.tenant.tenantId,
      ctx.user.id,
      ctx.user.name || ctx.user.email,
      versionId,
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    );
    revalidatePath("/portal");
    return { ok: true, message: "Gracias, quedó registrada tu lectura." };
  } catch (e) {
    return { ok: false, message: e instanceof DocumentError ? e.message : "No se pudo registrar." };
  }
}
