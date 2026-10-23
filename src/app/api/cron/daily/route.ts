import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { integrationAlerts } from "@/integrations/registry/service";
import { runLifecycleSweep } from "@/modules/billing/subscriptions";
import { syncDomains } from "@/modules/platform/tenants/service";
import { getPaymentProvider } from "@/integrations/payments";
import { retryDueCharges } from "@/modules/billing/charging";
import { billingHandlers } from "@/modules/billing/handlers";
import { registerBillingHooks } from "@/modules/billing/hooks";

export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  return got.length === expected.length && timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/**
 * Tarea diaria (6:00 a. m. hora de Colombia, ver vercel.json): barrido de suscripciones (vencimientos,
 * recordatorios de trial, mora), verificación de dominios y alertas de integraciones. Vercel Cron la
 * invoca con `Authorization: Bearer $CRON_SECRET`. El trabajo pesado va a la cola (Fase 1.4).
 */
export async function GET(req: Request) {
  if (!authorized(req)) return new NextResponse("Unauthorized", { status: 401 });
  registerBillingHooks();
  const errors: string[] = [];
  const guard = async <T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (e) {
      errors.push(`${name}: ${e instanceof Error ? e.message : "error"}`);
      return fallback;
    }
  };
  // Un fallo en una tarea (p. ej. Wompi sin configurar) no impide las demás.
  const sweep = await guard("suscripciones", () => runLifecycleSweep(billingHandlers()), {
    evaluated: 0,
    actions: [],
    reminders: [],
  });
  const retries = await guard("reintentos", () => retryDueCharges(getPaymentProvider()), []);
  const domains = await guard("dominios", () => syncDomains(), { checked: 0, changed: 0 });
  const alerts = await guard("integraciones", () => integrationAlerts(), []);
  return NextResponse.json({
    ok: errors.length === 0,
    sweep: {
      evaluated: sweep.evaluated,
      actions: sweep.actions.length,
      reminders: sweep.reminders.length,
    },
    retries: retries.length,
    domains,
    alerts: alerts.length,
    errors,
  });
}
