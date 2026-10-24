import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { schema, withTenant, type Tx } from "@/core/db";
import { assertWritable } from "@/core/plans/limits";
import { getActiveItems, getParameter } from "@/modules/platform/catalogs/service";
import {
  assessmentReminder,
  closeBlockers,
  ratingFor,
  scoreAssessment,
  trend,
  type ItemStatus,
  type RatingRange,
} from "./rules";
import { todayYmd } from "@/lib/dates";

const { selfAssessment, selfAssessmentItem, improvementItem, tenant } = schema;
export type Assessment = typeof selfAssessment.$inferSelect;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });
const today = () => todayYmd();

export class AssessmentError extends Error {}

type StdItem = {
  phva: string;
  standardCode: string;
  standardName: string;
  itemCode: string;
  criterion: string;
  verification: string;
  weight: number;
  appliesToGroups: number[];
};

async function ratingRanges(): Promise<RatingRange[]> {
  const a = await getActiveItems<RatingRange>("rating_ranges");
  return a?.items ?? [];
}

/** Inicia la autoevaluación del año con los ítems del catálogo vigente que aplican al grupo (7, 21 o 60) de la empresa. */
export async function startAssessment(tenantId: string, userId: string, year: number) {
  await assertWritable(tenantId);
  const active = await getActiveItems<StdItem>("standards_0312");
  const [t] = await withTenant(ctxOf(tenantId), (tx) =>
    tx.select().from(tenant).where(eq(tenant.id, tenantId)),
  );
  if (!t.standardsGroup)
    throw new AssessmentError("Completa el onboarding: aún no hay clasificación de estándares");
  const items = (active?.items ?? []).filter((i) => i.appliesToGroups.includes(t.standardsGroup!));
  if (!items.length)
    throw new AssessmentError(
      "El catálogo de estándares mínimos aún no está cargado para tu grupo. Contacta al administrador de la plataforma.",
    );
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const exists = await tx
      .select({ id: selfAssessment.id })
      .from(selfAssessment)
      .where(and(eq(selfAssessment.tenantId, tenantId), eq(selfAssessment.year, year)));
    if (exists.length) throw new AssessmentError(`Ya existe la autoevaluación ${year}`);
    const [a] = await tx
      .insert(selfAssessment)
      .values({
        tenantId,
        year,
        standardsGroup: t.standardsGroup!,
        catalogVersionId: active!.version.id,
      })
      .returning();
    await tx.insert(selfAssessmentItem).values(
      items.map((i) => ({
        tenantId,
        assessmentId: a.id,
        itemCode: i.itemCode,
        weight: String(i.weight),
        snapshot: {
          phva: i.phva,
          standardCode: i.standardCode,
          standardName: i.standardName,
          criterion: i.criterion,
          verification: i.verification,
        },
      })),
    );
    return a.id;
  });
}

async function loadDraft(tx: Tx, tenantId: string, assessmentId: string) {
  const [a] = await tx
    .select()
    .from(selfAssessment)
    .where(and(eq(selfAssessment.id, assessmentId), eq(selfAssessment.tenantId, tenantId)));
  if (!a) throw new AssessmentError("Autoevaluación no encontrada");
  return a;
}

export async function setItem(
  tenantId: string,
  userId: string,
  assessmentId: string,
  itemCode: string,
  input: {
    status: ItemStatus;
    justification?: string;
    responsibleName?: string;
    observations?: string;
    evidence?: string;
  },
) {
  await assertWritable(tenantId);
  if (!["pending", "cumple", "no_cumple", "no_aplica"].includes(input.status))
    throw new AssessmentError("Estado inválido");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const a = await loadDraft(tx, tenantId, assessmentId);
    if (a.status === "closed") throw new AssessmentError("La autoevaluación está cerrada");
    const clean = (v?: string) => v?.trim() || null;
    const r = await tx
      .update(selfAssessmentItem)
      .set({
        status: input.status,
        justification: clean(input.justification),
        responsibleName: clean(input.responsibleName),
        observations: clean(input.observations),
        evidence: clean(input.evidence),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(selfAssessmentItem.assessmentId, assessmentId),
          eq(selfAssessmentItem.itemCode, itemCode),
        ),
      )
      .returning({ id: selfAssessmentItem.id });
    if (!r.length) throw new AssessmentError("Ítem no encontrado");
  });
}

/**
 * Cierra la autoevaluación: calcula puntaje y rango, y genera el plan de mejoramiento con una acción por cada ítem que
 * no cumple. Queda como registro histórico inmodificable.
 */
export async function closeAssessment(tenantId: string, userId: string, assessmentId: string) {
  await assertWritable(tenantId);
  const ranges = await ratingRanges();
  const noApply = await getParameter("autoevaluacion.no_aplica_cuenta_completo", true);
  const result = await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const a = await loadDraft(tx, tenantId, assessmentId);
    if (a.status === "closed") throw new AssessmentError("La autoevaluación ya está cerrada");
    const items = await tx
      .select()
      .from(selfAssessmentItem)
      .where(eq(selfAssessmentItem.assessmentId, assessmentId));
    const blockers = closeBlockers(items.map((i) => ({ ...i, status: i.status as ItemStatus })));
    if (blockers.length) throw new AssessmentError(blockers.join(". "));
    const score = scoreAssessment(
      items.map((i) => ({ status: i.status as ItemStatus, weight: Number(i.weight) })),
      { noApplyCountsAsFull: noApply },
    );
    const rating = ratingFor(score.pct, ranges);
    await tx
      .update(selfAssessment)
      .set({
        status: "closed",
        scorePct: String(score.pct),
        ratingLevel: rating?.level ?? null,
        closedAt: new Date(),
        closedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(selfAssessment.id, assessmentId));
    const failing = items.filter((i) => i.status === "no_cumple");
    if (failing.length)
      await tx.insert(improvementItem).values(
        failing.map((i) => ({
          tenantId,
          assessmentId,
          itemCode: i.itemCode,
          description: `Cumplir: ${i.snapshot.criterion}`,
          responsibleName: i.responsibleName,
        })),
      );
    return {
      ...score,
      level: rating?.level ?? null,
      actions: rating?.actions ?? [],
      improvements: failing.length,
    };
  });
  // El plan de mejoramiento también alimenta el módulo central de acciones (CAPA), sin duplicar por ítem.
  if (result.improvements) {
    const { createAction } = await import("@/modules/capa/service");
    const items = await listImprovements(tenantId, assessmentId);
    const fallbackDue = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    for (const i of items)
      await createAction(
        tenantId,
        userId,
        {
          type: "corrective",
          title: i.description.slice(0, 200),
          responsibleName: i.responsibleName ?? "Por asignar",
          dueDate: i.dueDate ?? fallbackDue,
        },
        { source: "assessment", sourceId: i.id },
      ).catch(() => undefined);
  }
  return result;
}

export async function registerWithMinistry(
  tenantId: string,
  userId: string,
  assessmentId: string,
  date: string,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AssessmentError("Fecha inválida");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const a = await loadDraft(tx, tenantId, assessmentId);
    if (a.status !== "closed")
      throw new AssessmentError("Cierra la autoevaluación antes de registrarla");
    await tx
      .update(selfAssessment)
      .set({ registeredMinistryAt: date, updatedAt: new Date() })
      .where(eq(selfAssessment.id, assessmentId));
  });
}

export async function listAssessments(tenantId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(selfAssessment)
      .where(eq(selfAssessment.tenantId, tenantId))
      .orderBy(desc(selfAssessment.year)),
  );
}

export async function getAssessment(tenantId: string, id: string) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const [a] = await tx
      .select()
      .from(selfAssessment)
      .where(and(eq(selfAssessment.id, id), eq(selfAssessment.tenantId, tenantId)));
    if (!a) return null;
    const items = await tx
      .select()
      .from(selfAssessmentItem)
      .where(eq(selfAssessmentItem.assessmentId, id))
      .orderBy(asc(selfAssessmentItem.itemCode));
    const live = scoreAssessment(
      items.map((i) => ({ status: i.status as ItemStatus, weight: Number(i.weight) })),
    );
    return { assessment: a, items, live };
  });
}

/** Comparativo histórico entre años (solo evaluaciones cerradas). */
export async function history(tenantId: string) {
  const all = await listAssessments(tenantId);
  return trend(
    all
      .filter((a) => a.status === "closed")
      .map((a) => ({ year: a.year, pct: Number(a.scorePct), level: a.ratingLevel })),
  );
}

export async function listImprovements(tenantId: string, assessmentId?: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(improvementItem)
      .where(
        assessmentId
          ? and(
              eq(improvementItem.tenantId, tenantId),
              eq(improvementItem.assessmentId, assessmentId),
            )
          : eq(improvementItem.tenantId, tenantId),
      )
      .orderBy(asc(improvementItem.dueDate), asc(improvementItem.itemCode)),
  );
}

export async function updateImprovement(
  tenantId: string,
  userId: string,
  id: string,
  input: {
    responsibleName?: string;
    dueDate?: string;
    status: "open" | "in_progress" | "done";
    closureNote?: string;
  },
) {
  await assertWritable(tenantId);
  if (input.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate))
    throw new AssessmentError("Fecha inválida");
  if (input.status === "done" && !input.closureNote?.trim())
    throw new AssessmentError("Describe cómo se cerró la acción");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const r = await tx
      .update(improvementItem)
      .set({
        responsibleName: input.responsibleName?.trim() || null,
        dueDate: input.dueDate || null,
        status: input.status,
        closureNote: input.closureNote?.trim() || null,
        closedAt: input.status === "done" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(improvementItem.id, id), eq(improvementItem.tenantId, tenantId)))
      .returning({ id: improvementItem.id });
    if (!r.length) throw new AssessmentError("Acción no encontrada");
  });
}

/** Recordatorio de aplicar (diciembre) o registrar ante el Ministerio (plazo parametrizado). */
export async function assessmentReminderFor(tenantId: string, now = today()) {
  const [windowMonth, deadline] = await Promise.all([
    getParameter("autoevaluacion.mes_aplicacion", 12),
    getParameter("autoevaluacion.plazo_registro_ministerio", ""),
  ]);
  const opts = { windowMonth, ministryDeadline: deadline || null };
  const year = Number(now.slice(0, 4));
  const all = await listAssessments(tenantId);
  const of = (y: number) => all.find((a) => a.year === y);
  const month = Number(now.slice(5, 7));
  if (month >= windowMonth) {
    const a = of(year);
    return assessmentReminder(now, opts, a?.status === "closed", Boolean(a?.registeredMinistryAt));
  }
  const prev = of(year - 1);
  return prev?.status === "closed" && !prev.registeredMinistryAt
    ? assessmentReminder(now, opts, true, false)
    : null;
}
