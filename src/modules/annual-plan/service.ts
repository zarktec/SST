import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { schema, withTenant, type Tx } from "@/core/db";
import { assertWritable } from "@/core/plans/limits";
import {
  activitySchema,
  contentHash,
  progress,
  suggestFromHazard,
  suggestFromImprovement,
  type ActivityInput,
  type ActivityStatus,
} from "./rules";

const { annualPlan, annualActivity, improvementItem, hazardMatrix, hazardRow } = schema;
export type Activity = typeof annualActivity.$inferSelect;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });

export class PlanError extends Error {}

export async function getOrCreatePlan(tenantId: string, userId: string, year: number) {
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [p] = await tx
      .insert(annualPlan)
      .values({ tenantId, year })
      .onConflictDoUpdate({ target: [annualPlan.tenantId, annualPlan.year], set: { year } })
      .returning();
    return p;
  });
}

export async function getPlan(tenantId: string, year: number) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const [plan] = await tx
      .select()
      .from(annualPlan)
      .where(and(eq(annualPlan.tenantId, tenantId), eq(annualPlan.year, year)));
    if (!plan) return null;
    const activities = await tx
      .select()
      .from(annualActivity)
      .where(eq(annualActivity.planId, plan.id))
      .orderBy(asc(annualActivity.startDate), asc(annualActivity.title));
    return { plan, activities, progress: progress(activities) };
  });
}

async function loadPlan(tx: Tx, tenantId: string, planId: string) {
  const [p] = await tx
    .select()
    .from(annualPlan)
    .where(and(eq(annualPlan.id, planId), eq(annualPlan.tenantId, tenantId)));
  if (!p) throw new PlanError("Plan no encontrado");
  return p;
}
const structural = (a: Activity[]) => a.map((x) => ({ ...x }));

/** Agrega o modifica una actividad. Con el plan firmado solo se permite avanzar el estado (ver `setStatus`). */
export async function saveActivity(
  tenantId: string,
  userId: string,
  planId: string,
  input: ActivityInput,
  activityId?: string,
) {
  const a = activitySchema.parse(input);
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const p = await loadPlan(tx, tenantId, planId);
    if (p.status === "signed")
      throw new PlanError("El plan está firmado: reábrelo para modificar actividades");
    if (
      !a.startDate.startsWith(String(p.year)) &&
      !a.endDate.startsWith(String(p.year)) &&
      !(a.startDate < `${p.year}-01-01` && a.endDate > `${p.year}-12-31`)
    )
      throw new PlanError(`Las fechas deben estar dentro de ${p.year}`);
    const values = {
      phva: a.phva,
      title: a.title,
      objective: a.objective,
      responsibleName: a.responsibleName,
      startDate: a.startDate,
      endDate: a.endDate,
      resources: a.resources,
      budgetCents: a.budgetPesos === null ? null : BigInt(a.budgetPesos) * 100n,
      updatedAt: new Date(),
    };
    if (activityId) {
      const r = await tx
        .update(annualActivity)
        .set(values)
        .where(
          and(
            eq(annualActivity.id, activityId),
            eq(annualActivity.planId, planId),
            eq(annualActivity.tenantId, tenantId),
          ),
        )
        .returning({ id: annualActivity.id });
      if (!r.length) throw new PlanError("Actividad no encontrada");
      return activityId;
    }
    const [r] = await tx
      .insert(annualActivity)
      .values({ tenantId, planId, ...values })
      .returning({ id: annualActivity.id });
    return r.id;
  });
}

/** Estado de avance: permitido también con el plan firmado (es seguimiento, no cambio del plan). */
export async function setStatus(
  tenantId: string,
  userId: string,
  activityId: string,
  status: ActivityStatus,
  evidence?: string,
) {
  await assertWritable(tenantId);
  if (status === "done" && !evidence?.trim())
    throw new PlanError("Registra la evidencia de la ejecución");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const r = await tx
      .update(annualActivity)
      .set({
        status,
        evidence: evidence?.trim() || null,
        completedAt: status === "done" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(annualActivity.id, activityId), eq(annualActivity.tenantId, tenantId)))
      .returning({ id: annualActivity.id });
    if (!r.length) throw new PlanError("Actividad no encontrada");
  });
}

/**
 * Firma electrónica simple del empleador (alta dirección) o del responsable del SG-SST (Ley 527 de 1999, Decreto 2364 de 2012):
 * guarda quién firmó, cuándo y la huella del contenido. Cuando firman ambos, el plan queda firmado.
 */
export async function signPlan(
  tenantId: string,
  userId: string,
  planId: string,
  as: "employer" | "responsible",
) {
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const p = await loadPlan(tx, tenantId, planId);
    if (p.status === "signed") throw new PlanError("El plan ya está firmado");
    const items = await tx.select().from(annualActivity).where(eq(annualActivity.planId, planId));
    if (!items.length) throw new PlanError("El plan no tiene actividades");
    const hash = contentHash(p.year, structural(items));
    // Si el contenido cambió desde la firma de la otra parte, esa firma ya no vale.
    const stale = p.contentHash && p.contentHash !== hash;
    const emp = stale ? null : p.employerSignedAt;
    const res = stale ? null : p.responsibleSignedAt;
    const now = new Date();
    const next = {
      contentHash: hash,
      employerSignedBy: as === "employer" ? userId : stale ? null : p.employerSignedBy,
      employerSignedAt: as === "employer" ? now : emp,
      responsibleSignedBy: as === "responsible" ? userId : stale ? null : p.responsibleSignedBy,
      responsibleSignedAt: as === "responsible" ? now : res,
    };
    const both = next.employerSignedAt && next.responsibleSignedAt;
    await tx
      .update(annualPlan)
      .set({ ...next, status: both ? "signed" : "draft", updatedAt: now })
      .where(eq(annualPlan.id, planId));
    return { signed: Boolean(both) };
  });
}

/** Reabre un plan firmado para modificarlo; se limpian las firmas (deben volver a firmar ambos). */
export async function reopenPlan(tenantId: string, userId: string, planId: string) {
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    await loadPlan(tx, tenantId, planId);
    await tx
      .update(annualPlan)
      .set({
        status: "draft",
        employerSignedBy: null,
        employerSignedAt: null,
        responsibleSignedBy: null,
        responsibleSignedAt: null,
        contentHash: null,
        updatedAt: new Date(),
      })
      .where(eq(annualPlan.id, planId));
  });
}

/**
 * Plan de trabajo sugerido: genera actividades (idempotente) desde las acciones de mejoramiento abiertas y los peligros
 * con riesgo no aceptable (I o II) de la matriz vigente. Devuelve cuántas se agregaron.
 */
export async function suggestActivities(tenantId: string, userId: string, planId: string) {
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const p = await loadPlan(tx, tenantId, planId);
    if (p.status === "signed")
      throw new PlanError("El plan está firmado: reábrelo para agregar actividades");
    const improvements = await tx
      .select()
      .from(improvementItem)
      .where(and(eq(improvementItem.tenantId, tenantId), eq(improvementItem.status, "open")));
    const [matrix] = await tx
      .select()
      .from(hazardMatrix)
      .where(and(eq(hazardMatrix.tenantId, tenantId), eq(hazardMatrix.status, "approved")));
    const hazards = matrix
      ? await tx.select().from(hazardRow).where(eq(hazardRow.matrixId, matrix.id))
      : [];
    const suggestions = [
      ...improvements.map((i) => suggestFromImprovement(i, p.year)),
      ...hazards
        .map((h) =>
          suggestFromHazard(
            {
              id: h.id,
              hazardName: h.hazardName,
              task: h.task,
              riskLevel: h.riskLevel,
              ctrlEliminationOrBetter: h.ctrlElimination ?? h.ctrlSubstitution ?? h.ctrlEngineering,
            },
            p.year,
          ),
        )
        .filter((s): s is NonNullable<typeof s> => s !== null),
    ];
    let added = 0;
    for (const s of suggestions) {
      const r = await tx
        .insert(annualActivity)
        .values({
          tenantId,
          planId,
          phva: s.phva,
          title: s.title,
          objective: "objective" in s ? (s.objective ?? null) : null,
          responsibleName: "responsibleName" in s ? (s.responsibleName ?? null) : null,
          startDate: s.startDate,
          endDate: s.endDate,
          source: s.source,
          sourceId: s.sourceId,
        })
        .onConflictDoNothing()
        .returning({ id: annualActivity.id });
      added += r.length;
    }
    return added;
  });
}
