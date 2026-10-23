import "server-only";
import { and, eq } from "drizzle-orm";
import { schema, withTenant } from "@/core/db";
import { bogotaDate } from "@/core/calendar/business-days";
import { getActiveItems, getParameter } from "@/modules/platform/catalogs/service";
import {
  TREND_LENGTH,
  measure,
  periodKey,
  recentPeriods,
  statusOf,
  trendDirection,
  value,
  type IndicatorData,
  type Periodicity,
} from "./rules";

const { incident, absence, occupationalDisease, worker, indicatorTarget, indicatorNote } = schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });

export class IndicatorError extends Error {}

type CatalogIndicator = {
  name: string;
  type: string;
  numerator: string;
  denominator: string;
  factor: number;
  periodicity: Periodicity;
  target: number | null;
  sourceNorm: string;
};

async function loadData(tenantId: string): Promise<IndicatorData> {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const [acc, abs, dis, wk] = await Promise.all([
      tx
        .select()
        .from(incident)
        .where(and(eq(incident.tenantId, tenantId), eq(incident.kind, "accident"))),
      tx.select().from(absence).where(eq(absence.tenantId, tenantId)),
      tx.select().from(occupationalDisease).where(eq(occupationalDisease.tenantId, tenantId)),
      tx.select().from(worker).where(eq(worker.tenantId, tenantId)),
    ]);
    return {
      accidents: acc.map((a) => ({ occurredOn: bogotaDate(a.occurredAt), severity: a.severity })),
      absences: abs.map((a) => ({ cause: a.cause, startDate: a.startDate, endDate: a.endDate })),
      diseases: dis.map((d) => ({
        detectedOn: d.detectedOn,
        qualification: d.qualification,
        isNew: d.isNew,
      })),
      workers: wk
        .filter((w) => !w.deletedAt)
        .map((w) => ({ kind: w.kind, startDate: w.startDate, endDate: w.endDate })),
    };
  });
}

/**
 * Tablero de indicadores: para cada indicador del catálogo vigente, el valor del periodo de `ref` (según su periodicidad), la
 * tendencia de los periodos recientes, el cumplimiento de la meta (la de la empresa o, si no hay, la del catálogo) y el análisis
 * registrado. Los días cargados por muerte son parametrizables (TODO-NORMA).
 */
export async function dashboard(tenantId: string, ref: string) {
  const [cat, data, targets, notes, charged] = await Promise.all([
    getActiveItems<CatalogIndicator>("indicators"),
    loadData(tenantId),
    withTenant(ctxOf(tenantId), (tx) =>
      tx.select().from(indicatorTarget).where(eq(indicatorTarget.tenantId, tenantId)),
    ),
    withTenant(ctxOf(tenantId), (tx) =>
      tx.select().from(indicatorNote).where(eq(indicatorNote.tenantId, tenantId)),
    ),
    getParameter("indicadores.dias_cargados_mortal", 6000),
  ]);
  const own = new Map(targets.map((t) => [t.indicatorCode, Number(t.target)]));
  return (cat?.items ?? []).map((ind) => {
    const periods = recentPeriods(ind.periodicity, ref, TREND_LENGTH[ind.periodicity]);
    const points = periods.map((p) => {
      const m = measure(ind.code, data, p.from, p.to, { chargedDaysFatal: charged });
      return { ...p, measure: m, value: value(m, ind.factor) };
    });
    const current = points[points.length - 1];
    const target = own.get(ind.code) ?? ind.target ?? null;
    return {
      code: ind.code,
      name: ind.name,
      type: ind.type,
      numerator: ind.numerator,
      denominator: ind.denominator,
      factor: ind.factor,
      periodicity: ind.periodicity,
      sourceNorm: ind.sourceNorm,
      auto: current.measure !== null,
      target,
      ownTarget: own.has(ind.code),
      current,
      points,
      status: statusOf(current.value, target),
      trend: trendDirection(points.map((p) => p.value)),
      analysis:
        notes.find(
          (n) =>
            n.indicatorCode === ind.code &&
            n.periodKey === periodKey(ind.periodicity, current.from),
        )?.analysis ?? null,
    };
  });
}

export async function saveTarget(
  tenantId: string,
  userId: string,
  code: string,
  target: number | null,
) {
  if (target !== null && (!Number.isFinite(target) || target < 0))
    throw new IndicatorError("La meta debe ser un número mayor o igual a 0");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    if (target === null) {
      await tx
        .delete(indicatorTarget)
        .where(
          and(eq(indicatorTarget.tenantId, tenantId), eq(indicatorTarget.indicatorCode, code)),
        );
      return;
    }
    await tx
      .insert(indicatorTarget)
      .values({ tenantId, indicatorCode: code, target: String(target), updatedBy: userId })
      .onConflictDoUpdate({
        target: [indicatorTarget.tenantId, indicatorTarget.indicatorCode],
        set: { target: String(target), updatedBy: userId, updatedAt: new Date() },
      });
  });
}

export async function saveAnalysis(
  tenantId: string,
  userId: string,
  code: string,
  periodicity: Periodicity,
  from: string,
  analysis: string,
) {
  const text = analysis.trim();
  if (text.length < 10) throw new IndicatorError("Escribe el análisis (mínimo 10 caracteres)");
  const key = periodKey(periodicity, from);
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .insert(indicatorNote)
      .values({ tenantId, indicatorCode: code, periodKey: key, analysis: text, updatedBy: userId })
      .onConflictDoUpdate({
        target: [indicatorNote.tenantId, indicatorNote.indicatorCode, indicatorNote.periodKey],
        set: { analysis: text, updatedBy: userId, updatedAt: new Date() },
      }),
  );
}
