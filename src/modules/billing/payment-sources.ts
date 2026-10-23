import "server-only";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import { z } from "zod";
import { schema, withPlatform } from "@/core/db";
import type { PaymentProvider } from "@/integrations/payments/types";

const { paymentSource, subscription } = schema;
export type PaymentSource = typeof paymentSource.$inferSelect;
const SYSTEM = "system";

/** Datos que la pasarela devuelve al tokenizar (solo para mostrar: nunca el número completo ni el CVC). */
export const sourceDisplaySchema = z.object({
  brand: z.string().trim().max(30).optional(),
  last4: z
    .string()
    .regex(/^\d{4}$/, "Últimos 4 dígitos inválidos")
    .optional(),
  expMonth: z.number().int().min(1).max(12).optional(),
  /** Año de 2 o 4 dígitos (Wompi devuelve 2). */
  expYear: z.number().int().min(0).max(2999).optional(),
  holder: z.string().trim().max(80).optional(),
});

const normYear = (y: number | undefined) => (y === undefined ? undefined : y < 100 ? 2000 + y : y);

export async function listSources(tenantId: string): Promise<PaymentSource[]> {
  return withPlatform(
    { actorId: SYSTEM, action: "billing.sources.list", tenantId, audit: false },
    (tx) =>
      tx
        .select()
        .from(paymentSource)
        .where(
          and(
            eq(paymentSource.tenantId, tenantId),
            eq(paymentSource.active, true),
            isNull(paymentSource.deletedAt),
          ),
        )
        .orderBy(paymentSource.createdAt),
  );
}

/**
 * Registra un método de pago: la tarjeta se tokenizó en el NAVEGADOR directo contra la pasarela (nada pasa por nuestros
 * servidores); aquí solo se crea la fuente de pago con la llave privada y se guardan datos de visualización.
 * El primero queda como predeterminado.
 */
export async function registerPaymentSource(
  input: {
    tenantId: string;
    userId: string;
    customerEmail: string;
    token: string;
    type: "CARD" | "NEQUI";
    acceptanceToken: string;
    personalAuthToken: string;
    display?: z.input<typeof sourceDisplaySchema>;
  },
  provider: PaymentProvider,
): Promise<PaymentSource> {
  const display = sourceDisplaySchema.parse(input.display ?? {});
  const src = await provider.createPaymentSource({
    token: input.token,
    type: input.type,
    customerEmail: input.customerEmail,
    acceptanceToken: input.acceptanceToken,
    personalAuthToken: input.personalAuthToken,
  });
  return withPlatform(
    {
      actorId: input.userId,
      action: "billing.source.register",
      tenantId: input.tenantId,
      reason: `${input.type} ${display.last4 ?? ""}`,
    },
    async (tx) => {
      const [row] = await tx
        .insert(paymentSource)
        .values({
          tenantId: input.tenantId,
          providerSourceId: src.providerSourceId,
          type: src.type,
          brand: display.brand ?? null,
          last4: display.last4 ?? null,
          expMonth: display.expMonth ?? null,
          expYear: normYear(display.expYear) ?? null,
          holder: display.holder ?? null,
          createdBy: input.userId,
        })
        .returning();
      const [sub] = await tx
        .select()
        .from(subscription)
        .where(eq(subscription.tenantId, input.tenantId));
      if (sub && !sub.defaultPaymentSourceId)
        await tx
          .update(subscription)
          .set({ defaultPaymentSourceId: row.id, updatedAt: new Date() })
          .where(eq(subscription.id, sub.id));
      return row;
    },
  );
}

async function own(
  tx: Parameters<Parameters<typeof withPlatform>[1]>[0],
  tenantId: string,
  sourceId: string,
) {
  const [s] = await tx
    .select()
    .from(paymentSource)
    .where(
      and(
        eq(paymentSource.id, sourceId),
        eq(paymentSource.tenantId, tenantId),
        eq(paymentSource.active, true),
      ),
    );
  if (!s) throw new Error("Método de pago no encontrado");
  return s;
}

/** Marca un método como predeterminado (si era el de respaldo, el respaldo se libera). */
export async function setDefaultSource(tenantId: string, sourceId: string, actorId: string) {
  await withPlatform(
    { actorId, action: "billing.source.default", tenantId, reason: sourceId },
    async (tx) => {
      await own(tx, tenantId, sourceId);
      const [sub] = await tx.select().from(subscription).where(eq(subscription.tenantId, tenantId));
      await tx
        .update(subscription)
        .set({
          defaultPaymentSourceId: sourceId,
          ...(sub.backupPaymentSourceId === sourceId ? { backupPaymentSourceId: null } : {}),
          updatedAt: new Date(),
        })
        .where(eq(subscription.id, sub.id));
    },
  );
}

/** Define el método de respaldo (distinto del predeterminado). */
export async function setBackupSource(tenantId: string, sourceId: string | null, actorId: string) {
  await withPlatform(
    { actorId, action: "billing.source.backup", tenantId, reason: sourceId ?? "none" },
    async (tx) => {
      const [sub] = await tx.select().from(subscription).where(eq(subscription.tenantId, tenantId));
      if (sourceId) {
        await own(tx, tenantId, sourceId);
        if (sub.defaultPaymentSourceId === sourceId)
          throw new Error("El método de respaldo debe ser distinto del predeterminado");
      }
      await tx
        .update(subscription)
        .set({ backupPaymentSourceId: sourceId, updatedAt: new Date() })
        .where(eq(subscription.id, sub.id));
    },
  );
}

/** Elimina (desactiva) un método. Si era el predeterminado, el de respaldo lo reemplaza; el que cobra no queda colgado. */
export async function removeSource(tenantId: string, sourceId: string, actorId: string) {
  await withPlatform(
    { actorId, action: "billing.source.remove", tenantId, reason: sourceId },
    async (tx) => {
      await own(tx, tenantId, sourceId);
      const [sub] = await tx.select().from(subscription).where(eq(subscription.tenantId, tenantId));
      await tx
        .update(paymentSource)
        .set({ active: false, deletedAt: new Date() })
        .where(eq(paymentSource.id, sourceId));
      const patch: Partial<typeof subscription.$inferInsert> = { updatedAt: new Date() };
      if (sub.defaultPaymentSourceId === sourceId) {
        patch.defaultPaymentSourceId = sub.backupPaymentSourceId;
        patch.backupPaymentSourceId = null;
      } else if (sub.backupPaymentSourceId === sourceId) patch.backupPaymentSourceId = null;
      await tx.update(subscription).set(patch).where(eq(subscription.id, sub.id));
    },
  );
}

/** Tarjetas que vencen este mes o antes (para avisar a la empresa). */
export function isExpiringSoon(
  s: Pick<PaymentSource, "expMonth" | "expYear">,
  now = new Date(),
  withinDays = 30,
): boolean {
  if (!s.expMonth || !s.expYear) return false;
  // Una tarjeta vence el último día del mes indicado.
  const endOfMonth = new Date(Date.UTC(s.expYear, s.expMonth, 0, 23, 59, 59));
  return endOfMonth.getTime() - now.getTime() <= withinDays * 86_400_000;
}

export async function expiringSources(now = new Date(), withinDays = 30) {
  const rows = await withPlatform(
    { actorId: SYSTEM, action: "billing.sources.expiring", audit: false },
    (tx) =>
      tx
        .select()
        .from(paymentSource)
        .where(
          and(
            eq(paymentSource.active, true),
            or(lte(paymentSource.expYear, now.getUTCFullYear() + 1)),
          ),
        ),
  );
  return rows.filter((s) => isExpiringSoon(s, now, withinDays));
}
