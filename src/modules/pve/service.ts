import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { schema, withTenant, type Tx } from "@/core/db";
import { decrypt, encrypt } from "@/core/crypto/envelope";
import { assertWritable } from "@/core/plans/limits";
import { addDays, todayYmd } from "@/lib/dates";
import { createAction } from "@/modules/capa/service";
import { getParameter } from "@/modules/platform/catalogs/service";
import {
  activityDoneSchema,
  activitySchema,
  caseSchema,
  followUpState,
  followupSchema,
  programSchema,
  psychosocialNextDue,
  psychosocialSchema,
  psychosocialState,
} from "./rules";

const {
  pveProgram,
  pveActivity,
  pveCase,
  pveFollowup,
  psychosocialAssessment,
  worker,
  sensitiveAccessLog,
} = schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });
const aad = (tenantId: string) => `pve:${tenantId}`;
export class PveError extends Error {}

async function logAccess(
  tx: Tx,
  tenantId: string,
  userId: string,
  entityId: string,
  reason: string,
) {
  await tx
    .insert(sensitiveAccessLog)
    .values({ tenantId, actorId: userId, entity: "pve_case", entityId, reason });
}

// ---------- Programas y actividades ----------
export async function saveProgram(tenantId: string, userId: string, raw: unknown) {
  const d = programSchema.parse(raw);
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [dup] = await tx
      .select({ id: pveProgram.id })
      .from(pveProgram)
      .where(
        and(
          eq(pveProgram.tenantId, tenantId),
          eq(pveProgram.type, d.type),
          eq(pveProgram.active, true),
        ),
      );
    if (dup) throw new PveError("Ya hay un programa activo de ese tipo");
    const [p] = await tx
      .insert(pveProgram)
      .values({ tenantId, ...d })
      .returning({ id: pveProgram.id });
    return p.id;
  });
}
export async function closeProgram(tenantId: string, userId: string, id: string) {
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .update(pveProgram)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(pveProgram.id, id), eq(pveProgram.tenantId, tenantId))),
  );
}
export async function listPrograms(tenantId: string) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const programs = await tx
      .select()
      .from(pveProgram)
      .where(and(eq(pveProgram.tenantId, tenantId), eq(pveProgram.active, true)))
      .orderBy(asc(pveProgram.type));
    const acts = await tx
      .select()
      .from(pveActivity)
      .where(eq(pveActivity.tenantId, tenantId))
      .orderBy(desc(pveActivity.plannedOn));
    const cases = await tx
      .select({ programId: pveCase.programId, status: pveCase.status })
      .from(pveCase)
      .where(eq(pveCase.tenantId, tenantId));
    const today = todayYmd();
    return programs.map((p) => ({
      ...p,
      activities: acts
        .filter((a) => a.programId === p.id)
        .map((a) => ({ ...a, overdue: !a.performedOn && a.plannedOn < today })),
      openCases: cases.filter((c) => c.programId === p.id && c.status === "open").length,
      totalCases: cases.filter((c) => c.programId === p.id).length,
    }));
  });
}

export async function addActivity(tenantId: string, userId: string, raw: unknown) {
  const d = activitySchema.parse(raw);
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [p] = await tx
      .select({ id: pveProgram.id })
      .from(pveProgram)
      .where(and(eq(pveProgram.id, d.programId), eq(pveProgram.tenantId, tenantId)));
    if (!p) throw new PveError("Programa no encontrado");
    const [a] = await tx
      .insert(pveActivity)
      .values({ tenantId, ...d })
      .returning({ id: pveActivity.id });
    return a.id;
  });
}
export async function completeActivity(tenantId: string, userId: string, id: string, raw: unknown) {
  const d = activityDoneSchema.parse(raw);
  if (d.performedOn > todayYmd()) throw new PveError("La fecha no puede ser futura");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const r = await tx
      .update(pveActivity)
      .set({ performedOn: d.performedOn, participants: d.participants, updatedAt: new Date() })
      .where(and(eq(pveActivity.id, id), eq(pveActivity.tenantId, tenantId)))
      .returning({ id: pveActivity.id });
    if (!r.length) throw new PveError("Actividad no encontrada");
  });
}

// ---------- Casos ----------
export async function openCase(tenantId: string, userId: string, raw: unknown) {
  const d = caseSchema.parse(raw);
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [p] = await tx
      .select({ id: pveProgram.id })
      .from(pveProgram)
      .where(
        and(
          eq(pveProgram.id, d.programId),
          eq(pveProgram.tenantId, tenantId),
          eq(pveProgram.active, true),
        ),
      );
    if (!p) throw new PveError("Programa no encontrado");
    const [w] = await tx
      .select({ id: worker.id })
      .from(worker)
      .where(
        and(eq(worker.id, d.workerId), eq(worker.tenantId, tenantId), isNull(worker.deletedAt)),
      );
    if (!w) throw new PveError("Persona no encontrada");
    const [dup] = await tx
      .select({ id: pveCase.id })
      .from(pveCase)
      .where(
        and(
          eq(pveCase.programId, d.programId),
          eq(pveCase.workerId, d.workerId),
          eq(pveCase.status, "open"),
        ),
      );
    if (dup) throw new PveError("La persona ya tiene un caso abierto en este programa");
    const [c] = await tx
      .insert(pveCase)
      .values({
        tenantId,
        programId: d.programId,
        workerId: d.workerId,
        openedOn: d.openedOn,
        riskLevel: d.riskLevel,
        nextFollowUpOn: d.nextFollowUpOn,
        notesEncrypted: d.notes ? encrypt(d.notes, aad(tenantId)) : null,
      })
      .returning({ id: pveCase.id });
    return c.id;
  });
}

/** Seguimiento del caso: la nota se cifra y la próxima fecha reemplaza la anterior. */
export async function addFollowup(tenantId: string, userId: string, caseId: string, raw: unknown) {
  const d = followupSchema.parse(raw);
  await assertWritable(tenantId);
  if (d.performedOn > todayYmd()) throw new PveError("La fecha no puede ser futura");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [c] = await tx
      .select()
      .from(pveCase)
      .where(and(eq(pveCase.id, caseId), eq(pveCase.tenantId, tenantId)));
    if (!c) throw new PveError("Caso no encontrado");
    if (c.status === "closed") throw new PveError("El caso está cerrado");
    await tx.insert(pveFollowup).values({
      tenantId,
      caseId,
      performedOn: d.performedOn,
      noteEncrypted: encrypt(d.note, aad(tenantId)),
      nextFollowUpOn: d.nextFollowUpOn,
    });
    await tx
      .update(pveCase)
      .set({ nextFollowUpOn: d.nextFollowUpOn, updatedAt: new Date() })
      .where(eq(pveCase.id, caseId));
  });
}

export async function closeCase(
  tenantId: string,
  userId: string,
  caseId: string,
  closedOn: string,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(closedOn)) throw new PveError("Fecha inválida");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const r = await tx
      .update(pveCase)
      .set({ status: "closed", closedOn, nextFollowUpOn: null, updatedAt: new Date() })
      .where(
        and(eq(pveCase.id, caseId), eq(pveCase.tenantId, tenantId), eq(pveCase.status, "open")),
      )
      .returning({ id: pveCase.id });
    if (!r.length) throw new PveError("Caso no encontrado o ya cerrado");
  });
}

/** Lista de casos SIN notas (los detalles cifrados se leen con `getCase`, que registra el acceso). */
export async function listCases(tenantId: string) {
  const today = todayYmd();
  const rows = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({
        c: pveCase,
        name: worker.fullName,
        program: pveProgram.name,
        type: pveProgram.type,
      })
      .from(pveCase)
      .innerJoin(worker, eq(worker.id, pveCase.workerId))
      .innerJoin(pveProgram, eq(pveProgram.id, pveCase.programId))
      .where(eq(pveCase.tenantId, tenantId))
      .orderBy(desc(pveCase.openedOn)),
  );
  return rows.map(({ c, name, program, type }) => ({
    id: c.id,
    programId: c.programId,
    workerId: c.workerId,
    openedOn: c.openedOn,
    riskLevel: c.riskLevel,
    status: c.status,
    nextFollowUpOn: c.nextFollowUpOn,
    closedOn: c.closedOn,
    workerName: name,
    program,
    type,
    followUp: c.status === "open" ? followUpState(c.nextFollowUpOn, today) : ("sin_fecha" as const),
  }));
}

export async function getCase(tenantId: string, userId: string, caseId: string) {
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [c] = await tx
      .select()
      .from(pveCase)
      .where(and(eq(pveCase.id, caseId), eq(pveCase.tenantId, tenantId)));
    if (!c) return null;
    await logAccess(tx, tenantId, userId, caseId, "lectura");
    const fups = await tx
      .select()
      .from(pveFollowup)
      .where(eq(pveFollowup.caseId, caseId))
      .orderBy(desc(pveFollowup.performedOn));
    return {
      notes: c.notesEncrypted ? decrypt(c.notesEncrypted, aad(tenantId)) : null,
      followups: fups.map((f) => ({
        id: f.id,
        performedOn: f.performedOn,
        nextFollowUpOn: f.nextFollowUpOn,
        note: decrypt(f.noteEncrypted, aad(tenantId)),
      })),
    };
  });
}

// ---------- Riesgo psicosocial ----------
export async function recordPsychosocial(tenantId: string, userId: string, raw: unknown) {
  const d = psychosocialSchema.parse(raw);
  await assertWritable(tenantId);
  if (d.appliedOn > todayYmd()) throw new PveError("La fecha de aplicación no puede ser futura");
  const [high, mediumLow] = await Promise.all([
    getParameter("psicosocial.periodicidad_riesgo_alto_meses", 12),
    getParameter("psicosocial.periodicidad_riesgo_medio_bajo_meses", 24),
  ]);
  const nextDueOn = psychosocialNextDue(d.appliedOn, d.riskLevel, { high, mediumLow });
  const id = await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [r] = await tx
      .insert(psychosocialAssessment)
      .values({
        tenantId,
        appliedOn: d.appliedOn,
        psychologistName: d.psychologistName,
        licenseNumber: d.licenseNumber,
        riskLevel: d.riskLevel,
        scope: d.scope,
        notes: d.notes,
        nextDueOn,
      })
      .returning({ id: psychosocialAssessment.id });
    return r.id;
  });
  // El plan de intervención se vuelve acciones del módulo CAPA (origen "programa de vigilancia").
  const days = await getParameter("psicosocial.plazo_intervencion_dias", 90);
  let i = 0;
  for (const text of d.interventions)
    await createAction(
      tenantId,
      userId,
      {
        type: "preventive",
        title: `Intervención psicosocial: ${text}`.slice(0, 200),
        responsibleName: d.responsibleName ?? "Por asignar",
        dueDate: addDays(d.appliedOn, days),
      },
      { source: "pve", sourceId: `psy:${id}:${++i}` },
    );
  return { id, nextDueOn };
}

export async function listPsychosocial(tenantId: string) {
  const warn = await getParameter("psicosocial.alerta_dias", 60);
  const rows = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(psychosocialAssessment)
      .where(eq(psychosocialAssessment.tenantId, tenantId))
      .orderBy(desc(psychosocialAssessment.appliedOn)),
  );
  const state = psychosocialState(rows[0]?.nextDueOn ?? null, todayYmd(), warn);
  return { assessments: rows, state, nextDueOn: rows[0]?.nextDueOn ?? null };
}

export async function pveSummary(tenantId: string) {
  const [programs, cases, psy] = await Promise.all([
    listPrograms(tenantId),
    listCases(tenantId),
    listPsychosocial(tenantId),
  ]);
  return {
    programs: programs.length,
    openCases: cases.filter((c) => c.status === "open").length,
    followUpsOverdue: cases.filter((c) => c.followUp === "vencido").length,
    activitiesOverdue: programs.reduce(
      (s, p) => s + p.activities.filter((a) => a.overdue).length,
      0,
    ),
    psychosocial: psy.state,
  };
}
