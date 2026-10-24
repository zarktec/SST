"use server";
import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import {
  listTenantDomains,
  requestCustomDomain,
  syncDomains,
} from "@/modules/platform/tenants/service";
import { requireBillingAdmin } from "../facturacion/guard";

const fail = (e: unknown): FormState => ({
  ok: false,
  message: e instanceof Error ? e.message : "No se pudo completar la acción",
});

/** La empresa conecta su propio dominio (p. ej. sst.mi-empresa.com). Solo el administrador; una cuenta suspendida no cambia nada. */
export async function connectDomainAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requireBillingAdmin();
  if (ctx.readOnly) return { ok: false, message: "La cuenta está suspendida: solo lectura." };
  const host = String(f.get("host") ?? "");
  try {
    // Un dominio propio por empresa: para cambiarlo hay que soporte (el anterior sigue activo hasta entonces).
    const current = (await listTenantDomains(ctx.tenant.tenantId)).filter(
      (d) => d.kind === "custom",
    );
    if (current.some((d) => d.status !== "error"))
      return {
        ok: false,
        message: "Tu empresa ya tiene un dominio propio conectado.",
        values: { host },
      };
    await requestCustomDomain(ctx.tenant.tenantId, host, ctx.user.id);
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "No se pudo registrar el dominio",
      values: { host },
    };
  }
  revalidatePath("/dominio");
  return { ok: true, message: "Dominio registrado. Crea los registros DNS indicados y verifica." };
}

/** Comprueba ahora (sin esperar al cron diario) el estado de los dominios de la empresa. */
export async function verifyDomainsAction(): Promise<FormState> {
  const ctx = await requireBillingAdmin();
  try {
    await syncDomains(undefined, new Date(), ctx.tenant.tenantId);
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/dominio");
  return { ok: true, message: "Estado actualizado." };
}
