import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { integrationAlerts } from "@/integrations/registry/service";
import { runLifecycleSweep } from "@/modules/billing/subscriptions";
import { syncDomains } from "@/modules/platform/tenants/service";
import { billingHandlers } from "@/modules/billing/handlers";

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
  const [sweep, domains, alerts] = await Promise.all([
    runLifecycleSweep(billingHandlers()),
    syncDomains(),
    integrationAlerts(),
  ]);
  return NextResponse.json({
    ok: true,
    sweep: {
      evaluated: sweep.evaluated,
      actions: sweep.actions.length,
      reminders: sweep.reminders.length,
    },
    domains,
    alerts: alerts.length,
  });
}
