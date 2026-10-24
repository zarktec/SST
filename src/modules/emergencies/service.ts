import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { schema, withTenant } from "@/core/db";
import { assertWritable } from "@/core/plans/limits";
import { addDays, todayYmd } from "@/lib/dates";
import { createAction } from "@/modules/capa/service";
import { getParameter } from "@/modules/platform/catalogs/service";
import {
  assetInspectionSchema,
  assetSchema,
  brigadeSchema,
  drillResultSchema,
  drillSchema,
  drillStatus,
  expiryState,
  inspectionState,
  nextPlanReview,
  planSchema,
} from "./rules";

const { emergencyPlan, brigadeMember, emergencyAsset, emergencyAssetInspection, drill, worker } =
  schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });
export class EmergencyError extends Error {}

// ---------- Equipos ----------
export async function addAsset(tenantId: string, userId: string, raw: unknown) {
  const d = assetSchema.parse(raw);
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [a] = await tx
      .insert(emergencyAsset)
      .values({ tenantId, ...d })
      .returning({ id: emergencyAsset.id });
    return a.id;
  });
}

/** Registra una inspección del equipo; si no está en buen estado crea una acción correctiva. */
export async function inspectAsset(
  tenantId: string,
  userId: string,
  inspectorName: string,
  id: string,
  raw: unknown,
) {
  const d = assetInspectionSchema.parse(raw);
  await assertWritable(tenantId);
  if (d.performedOn > todayYmd())
    throw new EmergencyError("La fecha de inspección no puede ser futura");
  const asset = await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [a] = await tx
      .select()
      .from(emergencyAsset)
      .where(and(eq(emergencyAsset.id, id), eq(emergencyAsset.tenantId, tenantId)));
    if (!a) throw new EmergencyError("Equipo no encontrado");
    const [ins] = await tx
      .insert(emergencyAssetInspection)
      .values({
        tenantId,
        assetId: id,
        performedOn: d.performedOn,
        ok: d.ok,
        note: d.note,
        inspectorName,
      })
      .returning({ id: emergencyAssetInspection.id });
    if (!a.lastInspectedOn || d.performedOn >= a.lastInspectedOn)
      await tx
        .update(emergencyAsset)
        .set({ lastInspectedOn: d.performedOn, updatedAt: new Date() })
        .where(eq(emergencyAsset.id, id));
    return { ...a, inspectionId: ins.id };
  });
  if (!d.ok) {
    const days = await getParameter("emergencias.plazo_accion_dias", 15);
    await createAction(
      tenantId,
      userId,
      {
        type: "corrective",
        title: `Corregir equipo de emergencia ${asset.code}`.slice(0, 200),
        description: `${asset.location}. ${d.note ?? ""}`.trim(),
        responsibleName: inspectorName,
        dueDate: addDays(d.performedOn, days),
      },
      { source: "inspection", sourceId: `asset:${asset.inspectionId}` },
    );
  }
}

export async function renewAsset(tenantId: string, userId: string, id: string, expiresOn: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) throw new EmergencyError("Fecha inválida");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const r = await tx
      .update(emergencyAsset)
      .set({ expiresOn, updatedAt: new Date() })
      .where(and(eq(emergencyAsset.id, id), eq(emergencyAsset.tenantId, tenantId)))
      .returning({ id: emergencyAsset.id });
    if (!r.length) throw new EmergencyError("Equipo no encontrado");
  });
}

export async function retireAsset(tenantId: string, userId: string, id: string) {
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .update(emergencyAsset)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(emergencyAsset.id, id), eq(emergencyAsset.tenantId, tenantId))),
  );
}

export async function listAssets(tenantId: string) {
  const [warn, every] = await Promise.all([
    getParameter("emergencias.alerta_vencimiento_dias", 30),
    getParameter("emergencias.inspeccion_dias", 30),
  ]);
  const today = todayYmd();
  const rows = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(emergencyAsset)
      .where(and(eq(emergencyAsset.tenantId, tenantId), eq(emergencyAsset.active, true)))
      .orderBy(asc(emergencyAsset.kind), asc(emergencyAsset.code)),
  );
  return rows.map((a) => ({
    ...a,
    expiry: expiryState(a.expiresOn, today, warn),
    inspection: inspectionState(a.lastInspectedOn, today, every),
  }));
}

// ---------- Brigada ----------
export async function addBrigadeMember(tenantId: string, userId: string, raw: unknown) {
  const d = brigadeSchema.parse(raw);
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [w] = await tx
      .select({ id: worker.id })
      .from(worker)
      .where(
        and(eq(worker.id, d.workerId), eq(worker.tenantId, tenantId), isNull(worker.deletedAt)),
      );
    if (!w) throw new EmergencyError("Persona no encontrada");
    const [dup] = await tx
      .select({ id: brigadeMember.id })
      .from(brigadeMember)
      .where(
        and(
          eq(brigadeMember.tenantId, tenantId),
          eq(brigadeMember.workerId, d.workerId),
          eq(brigadeMember.role, d.role),
          eq(brigadeMember.active, true),
        ),
      );
    if (dup) throw new EmergencyError("Esa persona ya integra la brigada con ese rol");
    const [m] = await tx
      .insert(brigadeMember)
      .values({ tenantId, ...d })
      .returning({ id: brigadeMember.id });
    return m.id;
  });
}

export async function updateBrigadeMember(
  tenantId: string,
  userId: string,
  id: string,
  patch: { lastTrainingOn?: string; dotation?: string; active?: boolean },
) {
  if (patch.lastTrainingOn && !/^\d{4}-\d{2}-\d{2}$/.test(patch.lastTrainingOn))
    throw new EmergencyError("Fecha inválida");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const r = await tx
      .update(brigadeMember)
      .set({
        ...(patch.lastTrainingOn ? { lastTrainingOn: patch.lastTrainingOn } : {}),
        ...(patch.dotation !== undefined ? { dotation: patch.dotation.trim() || null } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(brigadeMember.id, id), eq(brigadeMember.tenantId, tenantId)))
      .returning({ id: brigadeMember.id });
    if (!r.length) throw new EmergencyError("Integrante no encontrado");
  });
}

export async function listBrigade(tenantId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ m: brigadeMember, name: worker.fullName })
      .from(brigadeMember)
      .innerJoin(worker, eq(worker.id, brigadeMember.workerId))
      .where(and(eq(brigadeMember.tenantId, tenantId), eq(brigadeMember.active, true)))
      .orderBy(asc(brigadeMember.role), asc(worker.fullName))
      .then((r) => r.map((x) => ({ ...x.m, name: x.name }))),
  );
}

// ---------- Plan ----------
/** Crea o actualiza el plan de la sede (o el general si no se indica sede). La próxima revisión se calcula (12 meses por defecto). */
export async function savePlan(tenantId: string, userId: string, raw: unknown) {
  const d = planSchema.parse(raw);
  await assertWritable(tenantId);
  const months = await getParameter("emergencias.revision_plan_meses", 12);
  const next = nextPlanReview(d.reviewedOn, months);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [cur] = await tx
      .select({ id: emergencyPlan.id })
      .from(emergencyPlan)
      .where(
        and(
          eq(emergencyPlan.tenantId, tenantId),
          d.workCenterId
            ? eq(emergencyPlan.workCenterId, d.workCenterId)
            : isNull(emergencyPlan.workCenterId),
        ),
      );
    const values = { ...d, nextReviewOn: next, updatedAt: new Date() };
    if (cur) await tx.update(emergencyPlan).set(values).where(eq(emergencyPlan.id, cur.id));
    else await tx.insert(emergencyPlan).values({ tenantId, ...values });
  });
}

export async function listPlans(tenantId: string) {
  const today = todayYmd();
  const rows = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ p: emergencyPlan, center: schema.workCenter.name })
      .from(emergencyPlan)
      .leftJoin(schema.workCenter, eq(schema.workCenter.id, emergencyPlan.workCenterId))
      .where(eq(emergencyPlan.tenantId, tenantId)),
  );
  return rows.map((r) => ({ ...r.p, center: r.center, reviewDue: r.p.nextReviewOn < today }));
}

// ---------- Simulacros ----------
export async function scheduleDrill(tenantId: string, userId: string, raw: unknown) {
  const d = drillSchema.parse(raw);
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [r] = await tx
      .insert(drill)
      .values({ tenantId, ...d })
      .returning({ id: drill.id });
    return r.id;
  });
}

/** Registra la ejecución y evaluación; cada mejora identificada se vuelve una acción CAPA (origen "simulacro"). */
export async function completeDrill(tenantId: string, userId: string, id: string, raw: unknown) {
  const d = drillResultSchema.parse(raw);
  await assertWritable(tenantId);
  if (d.performedOn > todayYmd())
    throw new EmergencyError("La fecha del simulacro no puede ser futura");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [x] = await tx
      .select()
      .from(drill)
      .where(and(eq(drill.id, id), eq(drill.tenantId, tenantId)));
    if (!x) throw new EmergencyError("Simulacro no encontrado");
    if (x.status !== "planned") throw new EmergencyError("El simulacro ya fue registrado");
    await tx
      .update(drill)
      .set({
        status: "done",
        performedOn: d.performedOn,
        participants: d.participants,
        evacuationMinutes: d.evacuationMinutes,
        evaluation: d.evaluation,
        updatedAt: new Date(),
      })
      .where(eq(drill.id, id));
  });
  const days = await getParameter("emergencias.plazo_accion_dias", 15);
  let i = 0;
  for (const text of d.improvements)
    await createAction(
      tenantId,
      userId,
      {
        type: "corrective",
        title: `Simulacro: ${text}`.slice(0, 200),
        responsibleName: d.responsibleName ?? "Por asignar",
        dueDate: addDays(d.performedOn, days),
      },
      { source: "drill", sourceId: `${id}:${++i}` },
    );
}

export async function cancelDrill(tenantId: string, userId: string, id: string) {
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .update(drill)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(drill.id, id), eq(drill.tenantId, tenantId), eq(drill.status, "planned"))),
  );
}

export async function listDrills(tenantId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ d: drill, center: schema.workCenter.name })
      .from(drill)
      .leftJoin(schema.workCenter, eq(schema.workCenter.id, drill.workCenterId))
      .where(eq(drill.tenantId, tenantId))
      .orderBy(desc(drill.plannedOn))
      .then((r) => r.map((x) => ({ ...x.d, center: x.center }))),
  );
}

/** Resumen y alertas del módulo: simulacro anual, equipos vencidos/por vencer o sin inspección, planes por revisar. */
export async function emergencySummary(tenantId: string) {
  const year = Number(todayYmd().slice(0, 4));
  const [required, drills, assets, plans, brigade] = await Promise.all([
    getParameter("emergencias.simulacros_minimos_anio", 1),
    listDrills(tenantId),
    listAssets(tenantId),
    listPlans(tenantId),
    listBrigade(tenantId),
  ]);
  return {
    drills: drillStatus(drills, year, required),
    assets: {
      total: assets.length,
      expired: assets.filter((a) => a.expiry === "vencido").length,
      expiring: assets.filter((a) => a.expiry === "por_vencer").length,
      inspectionDue: assets.filter((a) => a.inspection !== "al_dia").length,
    },
    plansDue: plans.filter((p) => p.reviewDue).length,
    hasPlan: plans.length > 0,
    brigadeSize: brigade.length,
  };
}
