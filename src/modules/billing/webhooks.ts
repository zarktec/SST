import "server-only";
import { eq } from "drizzle-orm";
import { schema, systemDb, withPlatform } from "@/core/db";
import type { PaymentProvider } from "@/integrations/payments/types";
import { applyTransaction } from "./charging";

export type WebhookResult = { status: 200 | 400 | 401; body: { ok: boolean; message?: string } };

/**
 * Procesa un webhook de la pasarela: verifica la firma, guarda el evento (idempotente por checksum), aplica el
 * resultado y responde rápido. Rechaza (401) lo que no esté firmado; responde 200 a los repetidos y a los eventos
 * que no son de transacciones para que la pasarela no reintente.
 */
export async function handleProviderWebhook(
  provider: PaymentProvider,
  body: unknown,
  headerChecksum: string | null,
  opts: { now?: Date } = {},
): Promise<WebhookResult> {
  let verified;
  try {
    verified = await provider.verifyEvent(body, headerChecksum);
  } catch (e) {
    // Integración inactiva o mal configurada: la pasarela reintentará (30 min, 3 h, 24 h).
    return {
      status: 400,
      body: { ok: false, message: e instanceof Error ? e.message : "No se pudo verificar" },
    };
  }
  if (!verified) return { status: 401, body: { ok: false, message: "Firma inválida" } };

  const db = systemDb();
  const inserted = await db
    .insert(schema.webhookEvent)
    .values({
      provider: provider.name,
      eventKey: verified.eventKey,
      type: verified.type,
      payload: body as object,
    })
    .onConflictDoNothing()
    .returning({ id: schema.webhookEvent.id });
  if (inserted.length === 0) return { status: 200, body: { ok: true, message: "duplicado" } };
  const eventId = inserted[0].id;

  try {
    const tx = verified.transaction;
    if (verified.type === "transaction.updated" && tx) {
      const [p] = await withPlatform(
        { actorId: "system", action: "billing.webhook.lookup", audit: false },
        (t) => t.select().from(schema.payment).where(eq(schema.payment.reference, tx.reference)),
      );
      if (p) await applyTransaction(p.id, tx, { now: opts.now });
    }
    await db
      .update(schema.webhookEvent)
      .set({ processedAt: opts.now ?? new Date() })
      .where(eq(schema.webhookEvent.id, eventId));
    return { status: 200, body: { ok: true } };
  } catch (e) {
    const message = e instanceof Error ? e.message : "error";
    await db
      .update(schema.webhookEvent)
      .set({ error: message })
      .where(eq(schema.webhookEvent.id, eventId));
    // 500 para que la pasarela reintente un fallo transitorio; el monto distinto es permanente: se registra y se responde 200.
    if (/no coincide/.test(message))
      return { status: 200, body: { ok: false, message } } as WebhookResult;
    throw e;
  }
}
