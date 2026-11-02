import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { schema, withTenant } from "@/core/db";
import { assertModuleEnabled, assertWritable } from "@/core/plans/limits";
import {
  DEFAULT_COMPETENCIES,
  assignmentSchema,
  commentSchema,
  cycleSchema,
  isSelfEvaluation,
  subjectSchema,
  tabulate,
  validateRatings,
  type Competency,
  type Level,
  type Ratings,
} from "./rules";

const { perfSettings, perfCycle, perfSubject, perfAssignment, perfResponse, worker } = schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });
export class PerformanceError extends Error {}

/** La evaluación 360 es un módulo por plan (clave `evaluacion_360`): el SUPER ADMIN decide qué planes lo incluyen. */
const gate = async (tenantId: string) => {
  await assertModuleEnabled(tenantId, "evaluacion_360");
  await assertWritable(tenantId);
};

/* ───────────────────────── Ajuste de la empresa ───────────────────────── */

/** Si los ciclos nuevos son anónimos. Por defecto sí (lo más protector); cada empresa lo cambia. */
export async function getSettings(tenantId: string) {
  const [s] = await withTenant(ctxOf(tenantId), (tx) =>
    tx.select().from(perfSettings).where(eq(perfSettings.tenantId, tenantId)),
  );
  return { anonymous: s?.anonymous ?? true };
}

/** Cambia el valor por defecto de los ciclos NUEVOS; los ciclos ya creados conservan el suyo. */
export async function saveSettings(tenantId: string, userId: string, anonymous: boolean) {
  await gate(tenantId);
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .insert(perfSettings)
      .values({ tenantId, anonymous, updatedBy: userId })
      .onConflictDoUpdate({
        target: perfSettings.tenantId,
        set: { anonymous, updatedBy: userId, updatedAt: new Date() },
      }),
  );
}

/* ───────────────────────────── Ciclos ───────────────────────────── */

export async function createCycle(tenantId: string, userId: string, raw: unknown) {
  const d = cycleSchema.parse(raw);
  await gate(tenantId);
  const { anonymous } = await getSettings(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [c] = await tx
      .insert(perfCycle)
      .values({
        tenantId,
        name: d.name,
        dueOn: d.dueOn,
        anonymous,
        competencies: DEFAULT_COMPETENCIES,
        createdBy: userId,
      })
      .returning({ id: perfCycle.id });
    return c.id;
  });
}

async function openCycle(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  tenantId: string,
  id: string,
) {
  const [c] = await tx
    .select()
    .from(perfCycle)
    .where(and(eq(perfCycle.id, id), eq(perfCycle.tenantId, tenantId)));
  if (!c) throw new PerformanceError("Ciclo no encontrado");
  if (c.status !== "open") throw new PerformanceError("El ciclo ya está cerrado");
  return c;
}

export async function addSubject(tenantId: string, userId: string, raw: unknown) {
  const d = subjectSchema.parse(raw);
  await gate(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    await openCycle(tx, tenantId, d.cycleId);
    const [w] = await tx
      .select({ id: worker.id, position: worker.position })
      .from(worker)
      .where(
        and(eq(worker.id, d.workerId), eq(worker.tenantId, tenantId), isNull(worker.deletedAt)),
      );
    if (!w) throw new PerformanceError("Persona no encontrada");
    const [dup] = await tx
      .select({ id: perfSubject.id })
      .from(perfSubject)
      .where(and(eq(perfSubject.cycleId, d.cycleId), eq(perfSubject.workerId, d.workerId)));
    if (dup) throw new PerformanceError("Esa persona ya está en el ciclo");
    const [s] = await tx
      .insert(perfSubject)
      .values({ tenantId, cycleId: d.cycleId, workerId: d.workerId, position: w.position })
      .returning({ id: perfSubject.id });
    return s.id;
  });
}

export async function addAssignment(tenantId: string, userId: string, raw: unknown) {
  const d = assignmentSchema.parse(raw);
  await gate(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [s] = await tx
      .select()
      .from(perfSubject)
      .where(and(eq(perfSubject.id, d.subjectId), eq(perfSubject.tenantId, tenantId)));
    if (!s) throw new PerformanceError("Persona evaluada no encontrada");
    await openCycle(tx, tenantId, s.cycleId);
    if (isSelfEvaluation(s.workerId, d.evaluatorWorkerId))
      throw new PerformanceError("Una persona no puede evaluarse a sí misma");
    const [e] = await tx
      .select({ id: worker.id, email: worker.email })
      .from(worker)
      .where(
        and(
          eq(worker.id, d.evaluatorWorkerId),
          eq(worker.tenantId, tenantId),
          isNull(worker.deletedAt),
        ),
      );
    if (!e) throw new PerformanceError("Evaluador no encontrado");
    // El evaluador entra con su cuenta; la ficha se vincula al usuario por el correo.
    if (!e.email)
      throw new PerformanceError("El evaluador no tiene correo en su ficha: agrégalo en Personas");
    const [dup] = await tx
      .select({ id: perfAssignment.id })
      .from(perfAssignment)
      .where(
        and(
          eq(perfAssignment.subjectId, d.subjectId),
          eq(perfAssignment.level, d.level),
          eq(perfAssignment.evaluatorWorkerId, d.evaluatorWorkerId),
        ),
      );
    if (dup) throw new PerformanceError("Ese evaluador ya está asignado en ese nivel");
    const [a] = await tx
      .insert(perfAssignment)
      .values({
        tenantId,
        cycleId: s.cycleId,
        subjectId: d.subjectId,
        level: d.level,
        evaluatorWorkerId: d.evaluatorWorkerId,
      })
      .returning({ id: perfAssignment.id });
    return a.id;
  });
}

/** Quita una asignación que aún no se respondió. */
export async function removeAssignment(tenantId: string, userId: string, id: string) {
  await gate(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [a] = await tx
      .select()
      .from(perfAssignment)
      .where(and(eq(perfAssignment.id, id), eq(perfAssignment.tenantId, tenantId)));
    if (!a) throw new PerformanceError("Asignación no encontrada");
    await openCycle(tx, tenantId, a.cycleId);
    if (a.submittedAt) throw new PerformanceError("Esa evaluación ya fue respondida");
    await tx.delete(perfAssignment).where(eq(perfAssignment.id, id));
  });
}

export async function closeCycle(tenantId: string, userId: string, id: string) {
  await gate(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    await openCycle(tx, tenantId, id);
    await tx
      .update(perfCycle)
      .set({ status: "closed", closedAt: new Date() })
      .where(eq(perfCycle.id, id));
  });
}

/** Ciclos con su avance (respondidas / asignadas) y cantidad de personas evaluadas. */
export async function listCycles(tenantId: string) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const cycles = await tx
      .select()
      .from(perfCycle)
      .where(eq(perfCycle.tenantId, tenantId))
      .orderBy(desc(perfCycle.createdAt));
    if (!cycles.length) return [];
    const ids = cycles.map((c) => c.id);
    const [subjects, assigns] = await Promise.all([
      tx
        .select({ cycleId: perfSubject.cycleId, n: sql<number>`count(*)::int` })
        .from(perfSubject)
        .where(inArray(perfSubject.cycleId, ids))
        .groupBy(perfSubject.cycleId),
      tx
        .select({
          cycleId: perfAssignment.cycleId,
          total: sql<number>`count(*)::int`,
          done: sql<number>`count(${perfAssignment.submittedAt})::int`,
        })
        .from(perfAssignment)
        .where(inArray(perfAssignment.cycleId, ids))
        .groupBy(perfAssignment.cycleId),
    ]);
    return cycles.map((c) => ({
      ...c,
      competencies: c.competencies as Competency[],
      subjects: subjects.find((s) => s.cycleId === c.id)?.n ?? 0,
      total: assigns.find((a) => a.cycleId === c.id)?.total ?? 0,
      done: assigns.find((a) => a.cycleId === c.id)?.done ?? 0,
    }));
  });
}

/** Personas evaluadas de un ciclo con sus evaluadores y quién ya respondió (nunca qué respondió). */
export async function cycleDetail(tenantId: string, cycleId: string) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const subjects = await tx
      .select({
        id: perfSubject.id,
        workerId: perfSubject.workerId,
        name: worker.fullName,
        position: perfSubject.position,
      })
      .from(perfSubject)
      .innerJoin(worker, eq(worker.id, perfSubject.workerId))
      .where(and(eq(perfSubject.cycleId, cycleId), eq(perfSubject.tenantId, tenantId)))
      .orderBy(asc(worker.fullName));
    const assigns = await tx
      .select({
        id: perfAssignment.id,
        subjectId: perfAssignment.subjectId,
        level: perfAssignment.level,
        submittedAt: perfAssignment.submittedAt,
        evaluator: worker.fullName,
      })
      .from(perfAssignment)
      .innerJoin(worker, eq(worker.id, perfAssignment.evaluatorWorkerId))
      .where(and(eq(perfAssignment.cycleId, cycleId), eq(perfAssignment.tenantId, tenantId)))
      .orderBy(asc(perfAssignment.level), asc(worker.fullName));
    return subjects.map((s) => ({
      ...s,
      assignments: assigns.filter((a) => a.subjectId === s.id),
    }));
  });
}

/* ──────────────────────── Responder (evaluador) ──────────────────────── */

/** Ficha de la persona que inició sesión (se vincula por correo, sin distinguir mayúsculas), igual que el portal. */
export async function workerOfUser(tenantId: string, email: string) {
  const [w] = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ id: worker.id, fullName: worker.fullName, position: worker.position })
      .from(worker)
      .where(
        and(
          eq(worker.tenantId, tenantId),
          isNull(worker.deletedAt),
          sql`lower(${worker.email}) = ${email.toLowerCase()}`,
        ),
      )
      .limit(1),
  );
  return w ?? null;
}

/** Evaluaciones que le faltan por responder a esta persona, en ciclos abiertos. */
export async function myPending(tenantId: string, email: string) {
  const me = await workerOfUser(tenantId, email);
  if (!me) return [];
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({
        id: perfAssignment.id,
        level: perfAssignment.level,
        cycle: perfCycle.name,
        dueOn: perfCycle.dueOn,
        anonymous: perfCycle.anonymous,
        subject: worker.fullName,
        position: perfSubject.position,
      })
      .from(perfAssignment)
      .innerJoin(perfCycle, eq(perfCycle.id, perfAssignment.cycleId))
      .innerJoin(perfSubject, eq(perfSubject.id, perfAssignment.subjectId))
      .innerJoin(worker, eq(worker.id, perfSubject.workerId))
      .where(
        and(
          eq(perfAssignment.tenantId, tenantId),
          eq(perfAssignment.evaluatorWorkerId, me.id),
          isNull(perfAssignment.submittedAt),
          eq(perfCycle.status, "open"),
        ),
      )
      .orderBy(asc(perfCycle.dueOn)),
  );
}

/** Datos para responder una evaluación; solo si es de esta persona, está pendiente y el ciclo sigue abierto. */
export async function formFor(tenantId: string, email: string, assignmentId: string) {
  const me = await workerOfUser(tenantId, email);
  if (!me) return null;
  const [r] = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({
        id: perfAssignment.id,
        level: perfAssignment.level,
        cycle: perfCycle.name,
        anonymous: perfCycle.anonymous,
        competencies: perfCycle.competencies,
        subject: worker.fullName,
        position: perfSubject.position,
      })
      .from(perfAssignment)
      .innerJoin(perfCycle, eq(perfCycle.id, perfAssignment.cycleId))
      .innerJoin(perfSubject, eq(perfSubject.id, perfAssignment.subjectId))
      .innerJoin(worker, eq(worker.id, perfSubject.workerId))
      .where(
        and(
          eq(perfAssignment.id, assignmentId),
          eq(perfAssignment.tenantId, tenantId),
          eq(perfAssignment.evaluatorWorkerId, me.id),
          isNull(perfAssignment.submittedAt),
          eq(perfCycle.status, "open"),
        ),
      ),
  );
  return r ? { ...r, competencies: r.competencies as Competency[] } : null;
}

/**
 * Envía las calificaciones. Marca la asignación como respondida y guarda la respuesta en la misma transacción; el UPDATE
 * condicional evita responder dos veces. En ciclos anónimos la respuesta NO guarda quién la envió, usa un id aleatorio (los
 * v7 son ordenables en el tiempo y permitirían cruzarla con la hora en que respondió cada evaluador) y toma la fecha del
 * ciclo en vez de la hora real.
 */
export async function submitResponse(
  tenantId: string,
  userId: string,
  email: string,
  assignmentId: string,
  rawRatings: Record<string, unknown>,
  rawComment?: string,
) {
  await gate(tenantId);
  const comment = commentSchema.parse(rawComment);
  const me = await workerOfUser(tenantId, email);
  if (!me) throw new PerformanceError("Tu usuario no está vinculado a una ficha de Personas");
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [a] = await tx
      .select()
      .from(perfAssignment)
      .where(
        and(
          eq(perfAssignment.id, assignmentId),
          eq(perfAssignment.tenantId, tenantId),
          eq(perfAssignment.evaluatorWorkerId, me.id),
        ),
      );
    if (!a) throw new PerformanceError("Evaluación no encontrada");
    const cycle = await openCycle(tx, tenantId, a.cycleId);
    const v = validateRatings(
      (cycle.competencies as Competency[]).map((c) => c.key),
      rawRatings,
    );
    if (!v.ok) throw new PerformanceError("Califica todas las competencias (de 1 a 5)");
    const claimed = await tx
      .update(perfAssignment)
      .set({ submittedAt: new Date() })
      .where(and(eq(perfAssignment.id, a.id), isNull(perfAssignment.submittedAt)))
      .returning({ id: perfAssignment.id });
    if (!claimed.length) throw new PerformanceError("Ya respondiste esta evaluación");
    await tx.insert(perfResponse).values({
      id: cycle.anonymous ? randomUUID() : undefined,
      tenantId,
      cycleId: a.cycleId,
      subjectId: a.subjectId,
      level: a.level,
      evaluatorWorkerId: cycle.anonymous ? null : me.id,
      ratings: v.ratings,
      comment,
      submittedAt: cycle.anonymous ? cycle.createdAt : new Date(),
    });
  });
}

/* ───────────────────────────── Resultados ───────────────────────────── */

/**
 * Resultados tabulados de un ciclo. `onlySubjectWorkerId`: la persona evaluada solo ve lo suyo, y únicamente con el ciclo
 * cerrado. Los comentarios se barajan y nunca llevan el nombre de quien los escribió en un ciclo anónimo.
 */
export async function cycleResults(
  tenantId: string,
  cycleId: string,
  opts: { onlySubjectWorkerId?: string } = {},
) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const [cycle] = await tx
      .select()
      .from(perfCycle)
      .where(and(eq(perfCycle.id, cycleId), eq(perfCycle.tenantId, tenantId)));
    if (!cycle) return null;
    if (opts.onlySubjectWorkerId && cycle.status !== "closed") return null;
    const competencies = cycle.competencies as Competency[];
    const subjects = await tx
      .select({
        id: perfSubject.id,
        workerId: perfSubject.workerId,
        name: worker.fullName,
        position: perfSubject.position,
      })
      .from(perfSubject)
      .innerJoin(worker, eq(worker.id, perfSubject.workerId))
      .where(
        and(
          eq(perfSubject.cycleId, cycleId),
          opts.onlySubjectWorkerId ? eq(perfSubject.workerId, opts.onlySubjectWorkerId) : undefined,
        ),
      )
      .orderBy(asc(worker.fullName));
    if (!subjects.length) return { cycle: { ...cycle, competencies }, competencies, results: [] };
    const responses = await tx
      .select()
      .from(perfResponse)
      .where(
        inArray(
          perfResponse.subjectId,
          subjects.map((s) => s.id),
        ),
      );
    const results = subjects.map((s) => {
      const mine = responses.filter((r) => r.subjectId === s.id);
      const comments = mine
        .filter((r) => r.comment)
        .map((r) => ({ level: r.level as Level, text: r.comment as string }))
        .sort(() => Math.random() - 0.5);
      return {
        ...s,
        tab: tabulate(
          competencies.map((c) => c.key),
          mine.map((r) => ({ level: r.level, ratings: r.ratings as Ratings })),
        ),
        comments,
      };
    });
    return { cycle: { ...cycle, competencies }, competencies, results };
  });
}

/** Ciclos cerrados en los que esta persona fue evaluada (para que vea su resultado). */
export async function myClosedCycles(tenantId: string, workerId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ id: perfCycle.id, name: perfCycle.name, closedAt: perfCycle.closedAt })
      .from(perfSubject)
      .innerJoin(perfCycle, eq(perfCycle.id, perfSubject.cycleId))
      .where(
        and(
          eq(perfSubject.tenantId, tenantId),
          eq(perfSubject.workerId, workerId),
          eq(perfCycle.status, "closed"),
        ),
      )
      .orderBy(desc(perfCycle.closedAt)),
  );
}
