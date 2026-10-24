import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { schema, withTenant } from "@/core/db";
import { bogotaDate } from "@/core/calendar/business-days";
import { assertWritable } from "@/core/plans/limits";
import { hashEvidence, isValidSignature } from "@/core/signature";
import { addDays, todayYmd } from "@/lib/dates";
import { listAssessments, getAssessment } from "@/modules/assessment/service";
import { capaSummary, createAction } from "@/modules/capa/service";
import { dashboard } from "@/modules/indicators/service";
import { listIncidents } from "@/modules/incidents/service";
import { getPlan } from "@/modules/annual-plan/service";
import { getParameter } from "@/modules/platform/catalogs/service";
import type { AuditItem, ReviewInputs } from "@/core/db/schema/audits";
import {
  auditExecutionSchema,
  auditSchema,
  closeBlockers,
  findingsOf,
  parseItems,
  reviewSchema,
  signBlockers,
} from "./rules";

const { audit, managementReview } = schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });
export class AuditError extends Error {}

// ---------- Auditoría interna ----------
export async function createAudit(tenantId: string, userId: string, raw: unknown) {
  const d = auditSchema.parse(raw);
  await assertWritable(tenantId);
  let items = parseItems(d.itemsText);
  if (!items.length && d.fromAssessment) {
    const last = (await listAssessments(tenantId))[0];
    const full = last ? await getAssessment(tenantId, last.id) : null;
    items = (full?.items ?? [])
      .map((i) => i.snapshot.criterion)
      .slice(0, 80)
      .map((text, idx) => ({ id: `a${idx + 1}`, text }));
  }
  if (!items.length)
    throw new AuditError("Agrega al menos un ítem a la lista de verificación (uno por línea)");
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [a] = await tx
      .insert(audit)
      .values({
        tenantId,
        year: Number(d.plannedOn.slice(0, 4)),
        title: d.title,
        scope: d.scope,
        plannedOn: d.plannedOn,
        checklist: items,
      })
      .returning({ id: audit.id });
    return a.id;
  });
}

/** Guarda el avance: datos de la ejecución y el resultado de cada ítem. La auditoría pasa a "en curso". */
export async function saveAudit(
  tenantId: string,
  userId: string,
  id: string,
  raw: unknown,
  results: Record<string, { result?: string; note?: string }>,
) {
  const d = auditExecutionSchema.parse(raw);
  await assertWritable(tenantId);
  if (d.performedOn > todayYmd())
    throw new AuditError("La fecha de realización no puede ser futura");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [a] = await tx
      .select()
      .from(audit)
      .where(and(eq(audit.id, id), eq(audit.tenantId, tenantId)));
    if (!a) throw new AuditError("Auditoría no encontrada");
    if (a.status === "closed" || a.status === "cancelled")
      throw new AuditError("La auditoría ya está cerrada");
    const valid = ["conforms", "minor_nc", "major_nc", "observation", "na"];
    const checklist: AuditItem[] = a.checklist.map((i) => {
      const r = results[i.id];
      return {
        ...i,
        result:
          r?.result && valid.includes(r.result) ? (r.result as AuditItem["result"]) : undefined,
        note: r?.note?.trim() || undefined,
      };
    });
    await tx
      .update(audit)
      .set({ ...d, checklist, status: "in_progress", updatedAt: new Date() })
      .where(eq(audit.id, id));
  });
}

/** Cierra la auditoría si cumple los requisitos y convierte hallazgos y observaciones en acciones CAPA. */
export async function closeAudit(tenantId: string, userId: string, id: string) {
  await assertWritable(tenantId);
  const a = await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [a] = await tx
      .select()
      .from(audit)
      .where(and(eq(audit.id, id), eq(audit.tenantId, tenantId)));
    if (!a) throw new AuditError("Auditoría no encontrada");
    if (a.status === "closed" || a.status === "cancelled")
      throw new AuditError("La auditoría ya está cerrada");
    const blockers = closeBlockers(a);
    if (blockers.length) throw new AuditError(blockers.join(". "));
    await tx
      .update(audit)
      .set({ status: "closed", closedAt: new Date(), updatedAt: new Date() })
      .where(eq(audit.id, id));
    return a;
  });
  const days = await getParameter("auditoria.plazo_accion_dias", 30);
  const due = addDays(a.performedOn!, days);
  for (const f of findingsOf(a.checklist))
    await createAction(
      tenantId,
      userId,
      {
        type: f.result === "observation" ? "improvement" : "corrective",
        title:
          `${f.result === "major_nc" ? "NC mayor" : f.result === "minor_nc" ? "NC menor" : "Observación"} de auditoría: ${f.text}`.slice(
            0,
            200,
          ),
        description: f.note,
        responsibleName: a.auditorName ?? "Por asignar",
        dueDate: due,
      },
      { source: "audit", sourceId: `${id}:${f.id}` },
    );
  return { findings: findingsOf(a.checklist).length };
}

export async function cancelAudit(tenantId: string, userId: string, id: string) {
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .update(audit)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(audit.id, id), eq(audit.tenantId, tenantId), eq(audit.status, "planned"))),
  );
}

export async function listAudits(tenantId: string) {
  const rows = await withTenant(ctxOf(tenantId), (tx) =>
    tx.select().from(audit).where(eq(audit.tenantId, tenantId)).orderBy(desc(audit.plannedOn)),
  );
  const today = todayYmd();
  return rows.map((a) => ({
    ...a,
    findings: findingsOf(a.checklist).length,
    overdue: (a.status === "planned" || a.status === "in_progress") && a.plannedOn < today,
    blockers: a.status === "closed" || a.status === "cancelled" ? [] : closeBlockers(a),
  }));
}

/** Programa del año: al menos una auditoría cerrada. */
export async function auditProgram(tenantId: string, year: number) {
  const rows = (await listAudits(tenantId)).filter(
    (a) => a.year === year && a.status !== "cancelled",
  );
  return {
    year,
    planned: rows.filter((a) => a.status === "planned" || a.status === "in_progress").length,
    closed: rows.filter((a) => a.status === "closed").length,
    overdue: rows.filter((a) => a.overdue).length,
  };
}

// ---------- Revisión por la alta dirección ----------
/** Instantánea de las entradas que el sistema ya conoce para el año de la revisión. */
export async function buildReviewInputs(tenantId: string, year: number): Promise<ReviewInputs> {
  const today = todayYmd();
  const ref = year >= Number(today.slice(0, 4)) ? `${today.slice(0, 7)}-01` : `${year}-12-01`;
  const [incidents, ind, audits, capa, assessments, plan] = await Promise.all([
    listIncidents(tenantId),
    dashboard(tenantId, ref),
    listAudits(tenantId),
    capaSummary(tenantId),
    listAssessments(tenantId),
    getPlan(tenantId, year),
  ]);
  const yr = incidents.filter((i) => bogotaDate(i.occurredAt).startsWith(String(year)));
  const acc = yr.filter((i) => i.kind === "accident");
  const last = assessments.find((a) => a.status === "closed");
  return {
    generatedAt: new Date().toISOString(),
    accidents: {
      total: acc.length,
      fatal: acc.filter((i) => i.severity === "fatal").length,
      incidents: yr.length - acc.length,
    },
    indicators: ind.map((i) => ({ name: i.name, value: i.current.value, target: i.target })),
    audits: audits
      .filter((a) => a.year === year && a.status !== "cancelled")
      .map((a) => ({ title: a.title, status: a.status, findings: a.findings })),
    actions: capa,
    standards: last
      ? {
          year: last.year,
          scorePct: last.scorePct ? Number(last.scorePct) : null,
          level: last.ratingLevel,
        }
      : null,
    annualPlan: plan ? plan.progress : null,
  };
}

export async function createReview(tenantId: string, userId: string, year: number, raw: unknown) {
  const d = reviewSchema.parse(raw);
  await assertWritable(tenantId);
  const inputs = await buildReviewInputs(tenantId, year);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [r] = await tx
      .insert(managementReview)
      .values({
        tenantId,
        year,
        heldOn: d.heldOn,
        attendees: d.attendees,
        inputs,
        legalChanges: d.legalChanges,
        stakeholderComms: d.stakeholderComms,
        objectivesCompliance: d.objectivesCompliance,
        conclusions: d.conclusions,
        decisions: d.decisions,
      })
      .returning({ id: managementReview.id });
    return r.id;
  });
}

export async function saveReview(tenantId: string, userId: string, id: string, raw: unknown) {
  const d = reviewSchema.parse(raw);
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [r] = await tx
      .select()
      .from(managementReview)
      .where(and(eq(managementReview.id, id), eq(managementReview.tenantId, tenantId)));
    if (!r) throw new AuditError("Revisión no encontrada");
    if (r.status === "signed")
      throw new AuditError("La revisión está firmada y no se puede modificar");
    await tx
      .update(managementReview)
      .set({
        heldOn: d.heldOn,
        attendees: d.attendees,
        legalChanges: d.legalChanges,
        stakeholderComms: d.stakeholderComms,
        objectivesCompliance: d.objectivesCompliance,
        conclusions: d.conclusions,
        decisions: d.decisions,
        updatedAt: new Date(),
      })
      .where(eq(managementReview.id, id));
  });
}

export async function refreshReviewInputs(tenantId: string, userId: string, id: string) {
  const [r] = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(managementReview)
      .where(and(eq(managementReview.id, id), eq(managementReview.tenantId, tenantId))),
  );
  if (!r) throw new AuditError("Revisión no encontrada");
  if (r.status === "signed")
    throw new AuditError("La revisión está firmada y no se puede modificar");
  const inputs = await buildReviewInputs(tenantId, r.year);
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .update(managementReview)
      .set({ inputs, updatedAt: new Date() })
      .where(eq(managementReview.id, id)),
  );
}

/** Firma de la alta dirección. Congela la revisión y convierte cada decisión (una por línea) en una acción de mejora. */
export async function signReview(
  tenantId: string,
  userId: string,
  userName: string,
  id: string,
  signature: string,
  responsible: { name?: string; dueDate?: string },
  ev: { ip?: string | null; userAgent?: string | null } = {},
) {
  await assertWritable(tenantId);
  if (!isValidSignature(signature)) throw new AuditError("Falta la firma o no es válida");
  const at = new Date();
  const r = await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [r] = await tx
      .select()
      .from(managementReview)
      .where(and(eq(managementReview.id, id), eq(managementReview.tenantId, tenantId)));
    if (!r) throw new AuditError("Revisión no encontrada");
    if (r.status === "signed") throw new AuditError("La revisión ya está firmada");
    const blockers = signBlockers(r);
    if (blockers.length) throw new AuditError(blockers.join(". "));
    await tx
      .update(managementReview)
      .set({
        status: "signed",
        signedBy: userId,
        signedName: userName,
        signature,
        signedAt: at,
        evidenceHash: hashEvidence([
          id,
          JSON.stringify(r.inputs),
          r.conclusions,
          r.decisions,
          userId,
          at.toISOString(),
          signature,
          ev.ip ?? null,
          ev.userAgent ?? null,
        ]),
        updatedAt: at,
      })
      .where(eq(managementReview.id, id));
    return r;
  });
  const days = await getParameter("revision_direccion.plazo_decision_dias", 60);
  const due = responsible.dueDate || addDays(r.heldOn, days);
  let i = 0;
  for (const line of (r.decisions ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 5))
    await createAction(
      tenantId,
      userId,
      {
        type: "improvement",
        title: `Revisión por la dirección ${r.year}: ${line}`.slice(0, 200),
        responsibleName: responsible.name?.trim() || "Por asignar",
        dueDate: due,
      },
      { source: "management_review", sourceId: `${id}:${++i}` },
    );
}

export async function listReviews(tenantId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(managementReview)
      .where(eq(managementReview.tenantId, tenantId))
      .orderBy(desc(managementReview.year), asc(managementReview.heldOn)),
  );
}
