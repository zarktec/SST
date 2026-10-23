"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformStaff } from "@/core/auth/session";
import {
  cancel,
  extendTrial,
  grantFreeMonths,
  reactivate,
  suspend,
} from "@/modules/billing/subscriptions";
import {
  createTenantWithTrial,
  createTenantSchema,
  TenantError,
} from "@/modules/platform/tenants/service";

export type TenantFormState = { ok: boolean; message: string } | null;

const str = (f: FormData, n: string) => String(f.get(n) ?? "").trim();

export async function createTenantAction(
  _prev: TenantFormState,
  form: FormData,
): Promise<TenantFormState> {
  const staff = await requirePlatformStaff({ allow: ["SUPER_ADMIN"] });
  const parsed = createTenantSchema.safeParse({
    slug: str(form, "slug"),
    legalName: str(form, "legalName"),
    tradeName: str(form, "tradeName"),
    nit: str(form, "nit") || undefined,
    planId: str(form, "planId") || undefined,
    owner: { email: str(form, "ownerEmail") },
  });
  if (!parsed.success)
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa el formulario" };
  let id: string;
  try {
    id = (await createTenantWithTrial(parsed.data, staff.user.id)).tenantId;
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof TenantError || e instanceof Error ? e.message : "No se pudo crear la empresa",
    };
  }
  revalidatePath("/empresas");
  redirect(`/empresas/${id}`);
}

type Op =
  "suspend" | "reactivate" | "extend_trial" | "free_months" | "cancel_now" | "cancel_period_end";

/** Operaciones sobre la suscripción de una empresa. Solo SUPER_ADMIN; todas quedan auditadas. */
export async function tenantOperationAction(
  tenantId: string,
  op: Op,
  _prev: TenantFormState,
  form: FormData,
): Promise<TenantFormState> {
  const staff = await requirePlatformStaff({ allow: ["SUPER_ADMIN"] });
  const actorId = staff.user.id;
  try {
    switch (op) {
      case "suspend": {
        const reason = str(form, "reason");
        if (reason.length < 5)
          return { ok: false, message: "Indica el motivo (mín. 5 caracteres)" };
        await suspend(tenantId, { reason, actorId });
        break;
      }
      case "reactivate":
        await reactivate(tenantId, { actorId });
        break;
      case "extend_trial":
        await extendTrial(tenantId, Number(str(form, "days")), { actorId });
        break;
      case "free_months":
        await grantFreeMonths(tenantId, Number(str(form, "months")), { actorId });
        break;
      case "cancel_now":
        await cancel(tenantId, { mode: "now", actorId });
        break;
      case "cancel_period_end":
        await cancel(tenantId, { mode: "period_end", actorId });
        break;
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "No se pudo aplicar" };
  }
  revalidatePath(`/empresas/${tenantId}`);
  revalidatePath("/empresas");
  return { ok: true, message: "Listo." };
}
