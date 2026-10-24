import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { schema, withTenant } from "@/core/db";
import { bogotaDate } from "@/core/calendar/business-days";
import { assertModuleEnabled, assertWritable } from "@/core/plans/limits";
import { addDays, todayYmd } from "@/lib/dates";
import { createAction } from "@/modules/capa/service";
import { expiryState } from "@/modules/emergencies/rules";
import { getParameter } from "@/modules/platform/catalogs/service";
import {
  PREOP_ITEMS,
  crashSchema,
  driverSchema,
  pesvStats,
  preopSchema,
  vehicleDocs,
  vehicleSchema,
} from "./rules";

const { pesvVehicle, pesvDriver, pesvPreop, pesvCrash, worker } = schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });
export class PesvError extends Error {}
/** El PESV es un módulo opcional por plan. */
const gate = async (tenantId: string) => {
  await assertModuleEnabled(tenantId, "pesv");
  await assertWritable(tenantId);
};

export async function saveVehicle(tenantId: string, userId: string, raw: unknown, id?: string) {
  const d = vehicleSchema.parse(raw);
  await gate(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    if (id) {
      const r = await tx
        .update(pesvVehicle)
        .set({ ...d, updatedAt: new Date() })
        .where(and(eq(pesvVehicle.id, id), eq(pesvVehicle.tenantId, tenantId)))
        .returning({ id: pesvVehicle.id });
      if (!r.length) throw new PesvError("Vehículo no encontrado");
      return id;
    }
    const [dup] = await tx
      .select({ id: pesvVehicle.id })
      .from(pesvVehicle)
      .where(
        and(
          eq(pesvVehicle.tenantId, tenantId),
          eq(pesvVehicle.plate, d.plate),
          eq(pesvVehicle.active, true),
        ),
      );
    if (dup) throw new PesvError("Ya hay un vehículo activo con esa placa");
    const [v] = await tx
      .insert(pesvVehicle)
      .values({ tenantId, ...d })
      .returning({ id: pesvVehicle.id });
    return v.id;
  });
}
export async function retireVehicle(tenantId: string, userId: string, id: string) {
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .update(pesvVehicle)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(pesvVehicle.id, id), eq(pesvVehicle.tenantId, tenantId))),
  );
}
export async function listVehicles(tenantId: string) {
  const warn = await getParameter("pesv.alerta_vencimiento_dias", 30);
  const today = todayYmd();
  const rows = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(pesvVehicle)
      .where(and(eq(pesvVehicle.tenantId, tenantId), eq(pesvVehicle.active, true)))
      .orderBy(asc(pesvVehicle.plate)),
  );
  return rows.map((v) => ({ ...v, docs: vehicleDocs(v, today, warn) }));
}

export async function saveDriver(tenantId: string, userId: string, raw: unknown) {
  const d = driverSchema.parse(raw);
  await gate(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [w] = await tx
      .select({ id: worker.id })
      .from(worker)
      .where(
        and(eq(worker.id, d.workerId), eq(worker.tenantId, tenantId), isNull(worker.deletedAt)),
      );
    if (!w) throw new PesvError("Persona no encontrada");
    const [cur] = await tx
      .select({ id: pesvDriver.id })
      .from(pesvDriver)
      .where(
        and(
          eq(pesvDriver.tenantId, tenantId),
          eq(pesvDriver.workerId, d.workerId),
          eq(pesvDriver.active, true),
        ),
      );
    if (cur) {
      await tx
        .update(pesvDriver)
        .set({
          licenseCategory: d.licenseCategory,
          licenseExpiresOn: d.licenseExpiresOn,
          updatedAt: new Date(),
        })
        .where(eq(pesvDriver.id, cur.id));
      return cur.id;
    }
    const [r] = await tx
      .insert(pesvDriver)
      .values({ tenantId, ...d })
      .returning({ id: pesvDriver.id });
    return r.id;
  });
}
export async function retireDriver(tenantId: string, userId: string, id: string) {
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .update(pesvDriver)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(pesvDriver.id, id), eq(pesvDriver.tenantId, tenantId))),
  );
}
export async function listDrivers(tenantId: string) {
  const warn = await getParameter("pesv.alerta_vencimiento_dias", 30);
  const today = todayYmd();
  const rows = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ d: pesvDriver, name: worker.fullName })
      .from(pesvDriver)
      .innerJoin(worker, eq(worker.id, pesvDriver.workerId))
      .where(and(eq(pesvDriver.tenantId, tenantId), eq(pesvDriver.active, true)))
      .orderBy(asc(worker.fullName)),
  );
  return rows.map((r) => ({
    ...r.d,
    name: r.name,
    license: expiryState(r.d.licenseExpiresOn, today, warn),
  }));
}

/**
 * Registra la inspección preoperacional. `failed` = nombres de los ítems que fallaron. Una falla crítica crea una acción
 * correctiva con plazo corto (el vehículo no debe operar hasta corregirla).
 */
export async function submitPreop(
  tenantId: string,
  userId: string,
  driverName: string,
  raw: unknown,
  failed: Record<string, string>,
) {
  const d = preopSchema.parse(raw);
  await gate(tenantId);
  const results = PREOP_ITEMS.map((i) => ({
    item: i.item,
    critical: i.critical,
    ok: !(i.item in failed),
    note: failed[i.item]?.trim() || null,
  }));
  if (results.some((r) => !r.ok && !r.note)) throw new PesvError("Describe cada falla encontrada");
  const failCount = results.filter((r) => !r.ok).length;
  const v = await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [v] = await tx
      .select()
      .from(pesvVehicle)
      .where(
        and(
          eq(pesvVehicle.id, d.vehicleId),
          eq(pesvVehicle.tenantId, tenantId),
          eq(pesvVehicle.active, true),
        ),
      );
    if (!v) throw new PesvError("Vehículo no encontrado");
    await tx.insert(pesvPreop).values({
      tenantId,
      vehicleId: v.id,
      driverName,
      odometer: d.odometer,
      results,
      failCount,
      notes: d.notes,
    });
    return v;
  });
  const critical = results.filter((r) => !r.ok && r.critical);
  const days = await getParameter("pesv.plazo_falla_critica_dias", 2);
  const today = bogotaDate(new Date());
  for (const c of critical)
    await createAction(
      tenantId,
      userId,
      {
        type: "corrective",
        title: `Vehículo ${v.plate}: corregir ${c.item}`.slice(0, 200),
        description: c.note ?? undefined,
        responsibleName: driverName,
        dueDate: addDays(today, days),
      },
      { source: "inspection", sourceId: `preop:${v.id}:${today}:${c.item}` },
    );
  return { failCount, criticalFailures: critical.length };
}

export async function listPreops(tenantId: string, limit = 30) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ p: pesvPreop, plate: pesvVehicle.plate })
      .from(pesvPreop)
      .innerJoin(pesvVehicle, eq(pesvVehicle.id, pesvPreop.vehicleId))
      .where(eq(pesvPreop.tenantId, tenantId))
      .orderBy(desc(pesvPreop.performedAt))
      .limit(limit)
      .then((r) => r.map((x) => ({ ...x.p, plate: x.plate }))),
  );
}

export async function registerCrash(tenantId: string, userId: string, raw: unknown) {
  const d = crashSchema.parse(raw);
  await gate(tenantId);
  const occurredAt = new Date(`${d.date}T${d.time}:00-05:00`);
  if (Number.isNaN(occurredAt.getTime()) || occurredAt.getTime() > Date.now() + 3_600_000)
    throw new PesvError("Fecha u hora inválida");
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    if (d.vehicleId) {
      const [v] = await tx
        .select({ id: pesvVehicle.id })
        .from(pesvVehicle)
        .where(and(eq(pesvVehicle.id, d.vehicleId), eq(pesvVehicle.tenantId, tenantId)));
      if (!v) throw new PesvError("Vehículo no encontrado");
    }
    const [c] = await tx
      .insert(pesvCrash)
      .values({
        tenantId,
        vehicleId: d.vehicleId,
        driverName: d.driverName,
        occurredAt,
        place: d.place,
        description: d.description,
        injured: d.injured,
        fatalities: d.fatalities,
        atFault: d.atFault,
      })
      .returning({ id: pesvCrash.id });
    return c.id;
  });
}
export async function listCrashes(tenantId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ c: pesvCrash, plate: pesvVehicle.plate })
      .from(pesvCrash)
      .leftJoin(pesvVehicle, eq(pesvVehicle.id, pesvCrash.vehicleId))
      .where(eq(pesvCrash.tenantId, tenantId))
      .orderBy(desc(pesvCrash.occurredAt))
      .then((r) => r.map((x) => ({ ...x.c, plate: x.plate }))),
  );
}

/** Conteos base del año para el reporte anual de autogestión. */
export async function annualStats(tenantId: string, year: number) {
  const today = todayYmd();
  const [vehicles, drivers, preops, crashes] = await Promise.all([
    listVehicles(tenantId),
    listDrivers(tenantId),
    listPreops(tenantId, 5000),
    listCrashes(tenantId),
  ]);
  return pesvStats(
    {
      vehicles,
      drivers,
      preops: preops.map((p) => ({
        vehicleId: p.vehicleId,
        performedOn: bogotaDate(p.performedAt),
      })),
      crashes: crashes.map((c) => ({
        occurredOn: bogotaDate(c.occurredAt),
        injured: c.injured,
        fatalities: c.fatalities,
      })),
    },
    year,
    today,
  );
}
