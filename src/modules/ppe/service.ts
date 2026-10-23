import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { schema, withTenant } from "@/core/db";
import { assertWritable } from "@/core/plans/limits";
import { todayYmd } from "@/lib/dates";
import {
  deliveryHash,
  deliverySchema,
  dueDateOf,
  isValidSignature,
  itemSchema,
  ppeState,
  stockOf,
  stockSchema,
  type DeliveryInput,
  type ItemInput,
  type StockInput,
} from "./rules";

const { ppeItem, ppeRequirement, ppeStockEntry, ppeDelivery, worker } = schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });

export class PpeError extends Error {}

export async function saveItem(tenantId: string, userId: string, input: ItemInput, id?: string) {
  const d = itemSchema.parse(input);
  await assertWritable(tenantId);
  const values = {
    name: d.name,
    category: d.category,
    usefulLifeMonths: d.usefulLifeMonths,
    requiresSize: d.requiresSize,
    minStock: d.minStock,
    updatedAt: new Date(),
  };
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    if (id) {
      const r = await tx
        .update(ppeItem)
        .set(values)
        .where(and(eq(ppeItem.id, id), eq(ppeItem.tenantId, tenantId), isNull(ppeItem.deletedAt)))
        .returning({ id: ppeItem.id });
      if (!r.length) throw new PpeError("EPP no encontrado");
      return id;
    }
    const [r] = await tx
      .insert(ppeItem)
      .values({ tenantId, ...values })
      .returning({ id: ppeItem.id });
    return r.id;
  });
}

export async function archiveItem(tenantId: string, userId: string, id: string) {
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .update(ppeItem)
      .set({ deletedAt: new Date(), active: false })
      .where(and(eq(ppeItem.id, id), eq(ppeItem.tenantId, tenantId))),
  );
}

/** Catálogo con su stock actual (ingresos - entregas) y alerta de inventario bajo. */
export async function listItems(tenantId: string) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const items = await tx
      .select()
      .from(ppeItem)
      .where(and(eq(ppeItem.tenantId, tenantId), isNull(ppeItem.deletedAt)))
      .orderBy(asc(ppeItem.name));
    const entries = await tx
      .select({
        itemId: ppeStockEntry.itemId,
        n: sql<number>`coalesce(sum(${ppeStockEntry.quantity}),0)::int`,
      })
      .from(ppeStockEntry)
      .where(eq(ppeStockEntry.tenantId, tenantId))
      .groupBy(ppeStockEntry.itemId);
    const out = await tx
      .select({
        itemId: ppeDelivery.itemId,
        n: sql<number>`coalesce(sum(${ppeDelivery.quantity}),0)::int`,
      })
      .from(ppeDelivery)
      .where(eq(ppeDelivery.tenantId, tenantId))
      .groupBy(ppeDelivery.itemId);
    return items.map((i) => ({
      ...i,
      ...stockOf(
        entries.find((e) => e.itemId === i.id)?.n ?? 0,
        out.find((e) => e.itemId === i.id)?.n ?? 0,
        i.minStock,
      ),
    }));
  });
}

export async function addStock(tenantId: string, userId: string, input: StockInput) {
  const d = stockSchema.parse(input);
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [i] = await tx
      .select({ id: ppeItem.id })
      .from(ppeItem)
      .where(
        and(eq(ppeItem.id, d.itemId), eq(ppeItem.tenantId, tenantId), isNull(ppeItem.deletedAt)),
      );
    if (!i) throw new PpeError("EPP no encontrado");
    await tx.insert(ppeStockEntry).values({ tenantId, ...d, registeredBy: userId });
  });
}

export async function setRequirement(
  tenantId: string,
  userId: string,
  position: string,
  itemId: string,
  on: boolean,
) {
  const pos = position.trim();
  if (pos.length < 2) throw new PpeError("Indica el cargo");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const same = and(
      eq(ppeRequirement.tenantId, tenantId),
      eq(ppeRequirement.itemId, itemId),
      sql`lower(${ppeRequirement.position}) = lower(${pos})`,
    );
    if (on) {
      const [have] = await tx.select({ id: ppeRequirement.id }).from(ppeRequirement).where(same);
      if (!have) await tx.insert(ppeRequirement).values({ tenantId, position: pos, itemId });
    } else await tx.delete(ppeRequirement).where(same);
  });
}

/**
 * Registra una entrega con la firma táctil del trabajador. Descuenta del inventario (puede quedar en cero pero no negativo),
 * calcula la fecha de reposición con la vida útil del elemento y guarda la evidencia.
 */
export async function registerDelivery(
  tenantId: string,
  userId: string,
  input: DeliveryInput & { signature: string },
  ctx: { ip?: string | null; userAgent?: string | null } = {},
) {
  const d = deliverySchema.parse(input);
  await assertWritable(tenantId);
  if (!isValidSignature(input.signature))
    throw new PpeError("Falta la firma del trabajador o no es válida");
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [item] = await tx
      .select()
      .from(ppeItem)
      .where(
        and(eq(ppeItem.id, d.itemId), eq(ppeItem.tenantId, tenantId), isNull(ppeItem.deletedAt)),
      );
    if (!item) throw new PpeError("EPP no encontrado");
    const [w] = await tx
      .select({ id: worker.id })
      .from(worker)
      .where(
        and(eq(worker.id, d.workerId), eq(worker.tenantId, tenantId), isNull(worker.deletedAt)),
      );
    if (!w) throw new PpeError("Persona no encontrada");
    if (item.requiresSize && !d.size) throw new PpeError("Indica la talla");
    const [ent] = await tx
      .select({ n: sql<number>`coalesce(sum(${ppeStockEntry.quantity}),0)::int` })
      .from(ppeStockEntry)
      .where(eq(ppeStockEntry.itemId, item.id));
    const [out] = await tx
      .select({ n: sql<number>`coalesce(sum(${ppeDelivery.quantity}),0)::int` })
      .from(ppeDelivery)
      .where(eq(ppeDelivery.itemId, item.id));
    // El control de inventario aplica solo si la empresa lo usa (tiene ingresos registrados del elemento).
    if (ent.n > 0) {
      if (ent.n - out.n < d.quantity)
        throw new PpeError(`Inventario insuficiente de ${item.name} (hay ${ent.n - out.n})`);
    }
    const signedAt = new Date();
    const hash = deliveryHash({
      workerId: d.workerId,
      itemId: d.itemId,
      quantity: d.quantity,
      deliveredAt: d.deliveredAt,
      signedAt: signedAt.toISOString(),
      signature: input.signature,
      ip: ctx.ip ?? null,
      userAgent: ctx.userAgent ?? null,
    });
    const [r] = await tx
      .insert(ppeDelivery)
      .values({
        tenantId,
        ...d,
        dueDate: dueDateOf(d.deliveredAt, item.usefulLifeMonths),
        signatureData: input.signature,
        signedAt,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent?.slice(0, 300) ?? null,
        evidenceHash: hash,
        registeredBy: userId,
      })
      .returning({ id: ppeDelivery.id });
    return r.id;
  });
}

/** Matriz de EPP: por persona activa y cada elemento exigido a su cargo, con el estado de la última entrega. */
export async function ppeMatrix(tenantId: string) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const reqs = await tx
      .select()
      .from(ppeRequirement)
      .where(eq(ppeRequirement.tenantId, tenantId));
    const items = await tx
      .select()
      .from(ppeItem)
      .where(and(eq(ppeItem.tenantId, tenantId), isNull(ppeItem.deletedAt)));
    const byId = new Map(items.map((i) => [i.id, i]));
    const t = todayYmd();
    const people = (
      await tx
        .select()
        .from(worker)
        .where(and(eq(worker.tenantId, tenantId), isNull(worker.deletedAt)))
    ).filter((p) => !p.endDate || p.endDate >= t);
    const withReq = people.filter(
      (p) => p.position && reqs.some((r) => r.position.toLowerCase() === p.position!.toLowerCase()),
    );
    const ids = withReq.map((p) => p.id);
    const deliveries = ids.length
      ? await tx
          .select({
            workerId: ppeDelivery.workerId,
            itemId: ppeDelivery.itemId,
            deliveredAt: ppeDelivery.deliveredAt,
            dueDate: ppeDelivery.dueDate,
          })
          .from(ppeDelivery)
          .where(and(eq(ppeDelivery.tenantId, tenantId), inArray(ppeDelivery.workerId, ids)))
      : [];
    return {
      requirements: reqs,
      rows: withReq.map((p) => ({
        workerId: p.id,
        name: p.fullName,
        position: p.position!,
        items: reqs
          .filter(
            (r) => r.position.toLowerCase() === p.position!.toLowerCase() && byId.has(r.itemId),
          )
          .map((r) => ({
            itemId: r.itemId,
            itemName: byId.get(r.itemId)!.name,
            ...ppeState(
              deliveries.filter((d) => d.workerId === p.id && d.itemId === r.itemId),
              t,
            ),
          })),
      })),
    };
  });
}

export async function listDeliveries(tenantId: string, limit = 100) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({
        id: ppeDelivery.id,
        deliveredAt: ppeDelivery.deliveredAt,
        dueDate: ppeDelivery.dueDate,
        quantity: ppeDelivery.quantity,
        size: ppeDelivery.size,
        reason: ppeDelivery.reason,
        workerName: worker.fullName,
        itemName: ppeItem.name,
        hasSignature: sql<boolean>`${ppeDelivery.signatureData} is not null`,
      })
      .from(ppeDelivery)
      .innerJoin(worker, eq(worker.id, ppeDelivery.workerId))
      .innerJoin(ppeItem, eq(ppeItem.id, ppeDelivery.itemId))
      .where(eq(ppeDelivery.tenantId, tenantId))
      .orderBy(desc(ppeDelivery.deliveredAt))
      .limit(limit),
  );
}
