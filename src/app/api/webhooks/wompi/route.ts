import { NextResponse } from "next/server";
import { WompiProvider } from "@/integrations/payments/wompi/client";
import { registerBillingHooks } from "@/modules/billing/hooks";
import { handleProviderWebhook } from "@/modules/billing/webhooks";

/**
 * Webhook de Wompi (URL única del dominio raíz; se registra en el dashboard de Wompi por ambiente).
 * Verifica la firma con el secreto de eventos del Centro de integraciones, es idempotente y responde rápido.
 */
export async function POST(req: Request) {
  registerBillingHooks();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "JSON inválido" }, { status: 400 });
  }
  const res = await handleProviderWebhook(
    WompiProvider.fromRegistry(),
    body,
    req.headers.get("x-event-checksum"),
  );
  return NextResponse.json(res.body, { status: res.status });
}
