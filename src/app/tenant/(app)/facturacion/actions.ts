"use server";
import { revalidatePath } from "next/cache";
import { getPaymentProvider } from "@/integrations/payments";
import { saveBillingProfile } from "@/modules/billing/invoicing";
import { billingProfileSchema } from "@/modules/billing/billing-profile";
import {
  registerPaymentSource,
  removeSource,
  setBackupSource,
  setDefaultSource,
} from "@/modules/billing/payment-sources";
import {
  payNow,
  requestCancellation,
  selectPlan,
  undoCancellation,
} from "@/modules/billing/portal";
import { requireBillingAdmin } from "./guard";

export type FormState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  /** Valores enviados: React 19 reinicia el formulario tras la acción, así que se devuelven para no perder lo escrito. */
  values?: Record<string, string | boolean | string[]>;
} | null;
const done = () => revalidatePath("/facturacion");
const fail = (e: unknown): FormState => ({
  ok: false,
  message: e instanceof Error ? e.message : "No se pudo completar la acción",
});

export async function saveProfileAction(_p: FormState, f: FormData): Promise<FormState> {
  const ctx = await requireBillingAdmin();
  if (ctx.readOnly) return { ok: false, message: "La cuenta está suspendida: solo lectura." };
  const raw = {
    personType: f.get("personType"),
    idType: f.get("idType"),
    identification: f.get("identification"),
    checkDigit: f.get("checkDigit") ?? "",
    legalName: f.get("legalName"),
    address: f.get("address"),
    stateCode: f.get("stateCode"),
    cityCode: f.get("cityCode"),
    postalCode: f.get("postalCode") ?? "",
    phone: f.get("phone"),
    invoiceEmail: f.get("invoiceEmail"),
    fiscalResponsibilities: f.getAll("fiscalResponsibilities"),
    vatResponsible: f.get("vatResponsible") === "on",
  };
  const parsed = billingProfileSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, message: "Revisa los campos marcados.", fieldErrors, values: raw as never };
  }
  await saveBillingProfile(ctx.tenant.tenantId, ctx.user.id, raw as never);
  done();
  return { ok: true, message: "Datos de facturación guardados." };
}

export async function selectPlanAction(
  planId: string,
  period: "monthly" | "annual",
): Promise<FormState> {
  const ctx = await requireBillingAdmin();
  try {
    await selectPlan(ctx.tenant.tenantId, ctx.user.id, { planId, period });
    done();
    return { ok: true, message: "Plan actualizado. Se aplicará en tu próximo cobro." };
  } catch (e) {
    return fail(e);
  }
}

export async function payNowAction(sourceId?: string): Promise<FormState> {
  const ctx = await requireBillingAdmin();
  try {
    const r = await payNow(ctx.tenant.tenantId, getPaymentProvider(), sourceId);
    done();
    if (r.kind === "skipped")
      return {
        ok: false,
        message: `No se pudo cobrar ahora (${r.reason}). Revisa tu plan y método de pago.`,
      };
    return r.payment.status === "approved"
      ? { ok: true, message: "Pago aprobado. ¡Gracias!" }
      : {
          ok: r.payment.status === "pending",
          message:
            r.payment.status === "pending"
              ? "Pago en proceso: te avisaremos al confirmarse."
              : "El pago fue rechazado. Prueba con otro método.",
        };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelAction(): Promise<FormState> {
  const ctx = await requireBillingAdmin();
  try {
    await requestCancellation(ctx.tenant.tenantId, ctx.user.id);
    done();
    return { ok: true, message: "Cancelación registrada." };
  } catch (e) {
    return fail(e);
  }
}

export async function undoCancelAction(): Promise<FormState> {
  const ctx = await requireBillingAdmin();
  await undoCancellation(ctx.tenant.tenantId, ctx.user.id);
  done();
  return { ok: true, message: "Cancelación revertida." };
}

/** El token de la tarjeta lo generó el navegador directo con la pasarela; aquí solo se registra la fuente. */
export async function registerSourceAction(input: {
  token: string;
  acceptanceToken: string;
  personalAuthToken: string;
  display: { brand?: string; last4?: string; expMonth?: number; expYear?: number; holder?: string };
}): Promise<FormState> {
  const ctx = await requireBillingAdmin();
  try {
    await registerPaymentSource(
      {
        tenantId: ctx.tenant.tenantId,
        userId: ctx.user.id,
        customerEmail: ctx.user.email,
        type: "CARD",
        ...input,
      },
      getPaymentProvider(),
    );
    done();
    return { ok: true, message: "Método de pago agregado." };
  } catch (e) {
    return fail(e);
  }
}

export async function setDefaultSourceAction(id: string) {
  const ctx = await requireBillingAdmin();
  await setDefaultSource(ctx.tenant.tenantId, id, ctx.user.id);
  done();
}
export async function setBackupSourceAction(id: string | null) {
  const ctx = await requireBillingAdmin();
  await setBackupSource(ctx.tenant.tenantId, id, ctx.user.id);
  done();
}
export async function removeSourceAction(id: string) {
  const ctx = await requireBillingAdmin();
  await removeSource(ctx.tenant.tenantId, id, ctx.user.id);
  done();
}
