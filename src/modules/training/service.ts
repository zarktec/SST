import "server-only";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { schema, withTenant } from "@/core/db";
import { assertWritable } from "@/core/plans/limits";
import { findActiveWorkerByDocument } from "@/modules/workers/service";
import {
  competence,
  courseSchema,
  evidenceHash,
  isValidSignature,
  newAttendanceToken,
  questionSchema,
  scoreQuiz,
  sessionSchema,
  type CourseInput,
  type QuestionInput,
  type SessionInput,
} from "./rules";

const {
  trainingCourse,
  trainingQuestion,
  trainingSession,
  trainingAttendance,
  positionRequirement,
  worker,
} = schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });
const today = () => new Date().toISOString().slice(0, 10);

export class TrainingError extends Error {}

export async function listCourses(tenantId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(trainingCourse)
      .where(and(eq(trainingCourse.tenantId, tenantId), isNull(trainingCourse.deletedAt)))
      .orderBy(asc(trainingCourse.name)),
  );
}

export async function saveCourse(
  tenantId: string,
  userId: string,
  input: CourseInput,
  id?: string,
) {
  const d = courseSchema.parse(input);
  await assertWritable(tenantId);
  const values = {
    name: d.name,
    kind: d.kind,
    durationHours: d.durationHours === null ? null : String(d.durationHours),
    description: d.description,
    validityMonths: d.validityMonths,
    passScore: d.passScore,
    updatedAt: new Date(),
  };
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    if (id) {
      const r = await tx
        .update(trainingCourse)
        .set(values)
        .where(
          and(
            eq(trainingCourse.id, id),
            eq(trainingCourse.tenantId, tenantId),
            isNull(trainingCourse.deletedAt),
          ),
        )
        .returning({ id: trainingCourse.id });
      if (!r.length) throw new TrainingError("Curso no encontrado");
      return id;
    }
    const [c] = await tx
      .insert(trainingCourse)
      .values({ tenantId, ...values })
      .returning({ id: trainingCourse.id });
    return c.id;
  });
}

export async function archiveCourse(tenantId: string, userId: string, id: string) {
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .update(trainingCourse)
      .set({ deletedAt: new Date(), active: false })
      .where(and(eq(trainingCourse.id, id), eq(trainingCourse.tenantId, tenantId))),
  );
}

/** Reemplaza las preguntas de la evaluación del curso. Si hay preguntas, el curso debe tener puntaje mínimo. */
export async function setQuestions(
  tenantId: string,
  userId: string,
  courseId: string,
  questions: QuestionInput[],
) {
  const parsed = questions.map((q) => questionSchema.parse(q));
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [c] = await tx
      .select()
      .from(trainingCourse)
      .where(and(eq(trainingCourse.id, courseId), eq(trainingCourse.tenantId, tenantId)));
    if (!c) throw new TrainingError("Curso no encontrado");
    if (parsed.length && !c.passScore)
      throw new TrainingError("Define el puntaje mínimo del curso antes de agregar la evaluación");
    await tx
      .delete(trainingQuestion)
      .where(and(eq(trainingQuestion.courseId, courseId), eq(trainingQuestion.tenantId, tenantId)));
    if (parsed.length)
      await tx.insert(trainingQuestion).values(
        parsed.map((q, i) => ({
          tenantId,
          courseId,
          question: q.question,
          options: q.options.map((text) => ({ text })),
          correctIndex: q.correctIndex,
          position: i,
        })),
      );
  });
}

export async function listQuestions(tenantId: string, courseId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(trainingQuestion)
      .where(and(eq(trainingQuestion.courseId, courseId), eq(trainingQuestion.tenantId, tenantId)))
      .orderBy(asc(trainingQuestion.position)),
  );
}

export async function createSession(tenantId: string, userId: string, input: SessionInput) {
  const d = sessionSchema.parse(input);
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [c] = await tx
      .select({ id: trainingCourse.id })
      .from(trainingCourse)
      .where(
        and(
          eq(trainingCourse.id, d.courseId),
          eq(trainingCourse.tenantId, tenantId),
          isNull(trainingCourse.deletedAt),
        ),
      );
    if (!c) throw new TrainingError("Curso no encontrado");
    const [s] = await tx
      .insert(trainingSession)
      .values({ tenantId, ...d })
      .returning({ id: trainingSession.id });
    return s.id;
  });
}

/** Abre la sesión para registrar asistencia: genera el token del QR. Cerrarla invalida el QR. */
export async function openSession(tenantId: string, userId: string, id: string) {
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [s] = await tx
      .select()
      .from(trainingSession)
      .where(and(eq(trainingSession.id, id), eq(trainingSession.tenantId, tenantId)));
    if (!s) throw new TrainingError("Sesión no encontrada");
    if (s.status === "closed") throw new TrainingError("La sesión está cerrada");
    const token = s.attendanceToken ?? newAttendanceToken();
    await tx
      .update(trainingSession)
      .set({
        status: "open",
        attendanceToken: token,
        openedAt: s.openedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(trainingSession.id, id));
    return token;
  });
}

export async function closeSession(tenantId: string, userId: string, id: string) {
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const r = await tx
      .update(trainingSession)
      .set({ status: "closed", attendanceToken: null, closedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(trainingSession.id, id), eq(trainingSession.tenantId, tenantId)))
      .returning({ id: trainingSession.id });
    if (!r.length) throw new TrainingError("Sesión no encontrada");
  });
}

export async function listSessions(tenantId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ session: trainingSession, courseName: trainingCourse.name })
      .from(trainingSession)
      .innerJoin(trainingCourse, eq(trainingCourse.id, trainingSession.courseId))
      .where(eq(trainingSession.tenantId, tenantId))
      .orderBy(desc(trainingSession.date)),
  );
}

export async function getSession(tenantId: string, id: string) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const [row] = await tx
      .select({ session: trainingSession, course: trainingCourse })
      .from(trainingSession)
      .innerJoin(trainingCourse, eq(trainingCourse.id, trainingSession.courseId))
      .where(and(eq(trainingSession.id, id), eq(trainingSession.tenantId, tenantId)));
    if (!row) return null;
    const attendees = await tx
      .select({ a: trainingAttendance, name: worker.fullName, last4: worker.idLast4 })
      .from(trainingAttendance)
      .innerJoin(worker, eq(worker.id, trainingAttendance.workerId))
      .where(eq(trainingAttendance.sessionId, id))
      .orderBy(asc(worker.fullName));
    return {
      ...row,
      attendees: attendees.map((x) => ({
        ...x.a,
        signatureData: undefined,
        hasSignature: Boolean(x.a.signatureData),
        name: x.name,
        last4: x.last4,
      })),
    };
  });
}

/** Datos mínimos para la página pública del QR: no expone respuestas correctas ni listas de personas. */
export async function publicSessionByToken(tenantId: string, token: string) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const [row] = await tx
      .select({ session: trainingSession, course: trainingCourse })
      .from(trainingSession)
      .innerJoin(trainingCourse, eq(trainingCourse.id, trainingSession.courseId))
      .where(
        and(
          eq(trainingSession.tenantId, tenantId),
          eq(trainingSession.attendanceToken, token),
          eq(trainingSession.status, "open"),
        ),
      );
    if (!row) return null;
    const questions = await tx
      .select()
      .from(trainingQuestion)
      .where(eq(trainingQuestion.courseId, row.course.id))
      .orderBy(asc(trainingQuestion.position));
    return {
      sessionId: row.session.id,
      courseName: row.course.name,
      date: row.session.date,
      passScore: row.course.passScore,
      questions: questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options.map((o) => o.text),
      })),
    };
  });
}

/**
 * Asistencia por QR: la persona se identifica con su documento, firma con el dedo y (si el curso tiene evaluación) responde.
 * Se guarda la evidencia (fecha y hora, IP, dispositivo, huella). Los errores de identificación no revelan si el documento existe.
 */
export async function signAttendanceByToken(
  tenantId: string,
  token: string,
  input: {
    document: string;
    signature: string;
    answers?: (number | null)[];
    ip?: string | null;
    userAgent?: string | null;
  },
) {
  if (!isValidSignature(input.signature))
    throw new TrainingError("La firma no es válida. Vuelve a firmar.");
  const info = await publicSessionByToken(tenantId, token);
  if (!info) throw new TrainingError("Esta sesión no está abierta para registrar asistencia.");
  const w = await findActiveWorkerByDocument(tenantId, input.document);
  if (!w)
    throw new TrainingError(
      "No encontramos ese documento entre el personal activo. Verifica el número o pide ayuda al capacitador.",
    );
  const correct = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ c: trainingQuestion.correctIndex })
      .from(trainingQuestion)
      .innerJoin(trainingSession, eq(trainingSession.courseId, trainingQuestion.courseId))
      .where(eq(trainingSession.id, info.sessionId))
      .orderBy(asc(trainingQuestion.position)),
  );
  const hasQuiz = correct.length > 0;
  if (hasQuiz && (!input.answers || input.answers.length < correct.length))
    throw new TrainingError("Responde todas las preguntas de la evaluación.");
  const score = hasQuiz
    ? scoreQuiz(
        correct.map((x) => x.c),
        input.answers ?? [],
      )
    : null;
  const passed = score === null ? true : info.passScore ? score >= info.passScore : true;
  const signedAt = new Date();
  const hash = evidenceHash({
    sessionId: info.sessionId,
    workerId: w.id,
    signedAt: signedAt.toISOString(),
    signature: input.signature,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
  });
  return withTenant(ctxOf(tenantId), async (tx) => {
    const dup = await tx
      .select({ id: trainingAttendance.id })
      .from(trainingAttendance)
      .where(
        and(
          eq(trainingAttendance.sessionId, info.sessionId),
          eq(trainingAttendance.workerId, w.id),
        ),
      );
    if (dup.length) throw new TrainingError("Ya registraste tu asistencia en esta sesión.");
    await tx.insert(trainingAttendance).values({
      tenantId,
      sessionId: info.sessionId,
      workerId: w.id,
      method: "qr",
      signatureData: input.signature,
      signedAt,
      ip: input.ip ?? null,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      evidenceHash: hash,
      score,
      passed,
    });
    return { name: w.fullName, score, passed, courseName: info.courseName };
  });
}

/** Asistencia registrada por el capacitador (sin firma táctil): queda marcada como manual con quién la registró. */
export async function registerManualAttendance(
  tenantId: string,
  userId: string,
  sessionId: string,
  workerId: string,
  passed = true,
) {
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [s] = await tx
      .select()
      .from(trainingSession)
      .where(and(eq(trainingSession.id, sessionId), eq(trainingSession.tenantId, tenantId)));
    if (!s) throw new TrainingError("Sesión no encontrada");
    const [w] = await tx
      .select({ id: worker.id })
      .from(worker)
      .where(and(eq(worker.id, workerId), eq(worker.tenantId, tenantId), isNull(worker.deletedAt)));
    if (!w) throw new TrainingError("Persona no encontrada");
    const signedAt = new Date();
    const hash = evidenceHash({
      sessionId,
      workerId,
      signedAt: signedAt.toISOString(),
      signature: null,
      ip: null,
      userAgent: `manual:${userId}`,
    });
    const r = await tx
      .insert(trainingAttendance)
      .values({
        tenantId,
        sessionId,
        workerId,
        method: "manual",
        signedAt,
        evidenceHash: hash,
        passed,
        registeredBy: userId,
      })
      .onConflictDoNothing()
      .returning({ id: trainingAttendance.id });
    if (!r.length) throw new TrainingError("Esa persona ya tiene asistencia en la sesión");
  });
}

export async function setRequirement(
  tenantId: string,
  userId: string,
  position: string,
  courseId: string,
  on: boolean,
) {
  const pos = position.trim();
  if (pos.length < 2) throw new TrainingError("Indica el cargo");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    // El cargo se compara sin distinguir mayúsculas (igual que en la matriz).
    const same = and(
      eq(positionRequirement.tenantId, tenantId),
      eq(positionRequirement.courseId, courseId),
      sql`lower(${positionRequirement.position}) = lower(${pos})`,
    );
    if (on) {
      const [have] = await tx
        .select({ id: positionRequirement.id })
        .from(positionRequirement)
        .where(same);
      if (!have) await tx.insert(positionRequirement).values({ tenantId, position: pos, courseId });
    } else await tx.delete(positionRequirement).where(same);
  });
}

/** Matriz de competencias: por persona activa y por cada curso exigido a su cargo, cumple / vencido / pendiente. */
export async function competenceMatrix(tenantId: string) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const reqs = await tx
      .select()
      .from(positionRequirement)
      .where(eq(positionRequirement.tenantId, tenantId));
    if (!reqs.length)
      return {
        requirements: [] as typeof reqs,
        rows: [] as {
          workerId: string;
          name: string;
          position: string;
          items: { courseId: string; courseName: string; state: string; dueDate: string | null }[];
        }[],
      };
    const courses = await tx
      .select()
      .from(trainingCourse)
      .where(and(eq(trainingCourse.tenantId, tenantId), isNull(trainingCourse.deletedAt)));
    const byId = new Map(courses.map((c) => [c.id, c]));
    const t = today();
    const people = await tx
      .select()
      .from(worker)
      .where(and(eq(worker.tenantId, tenantId), isNull(worker.deletedAt)));
    const active = people.filter((p) => !p.endDate || p.endDate >= t);
    const withReq = active.filter(
      (p) => p.position && reqs.some((r) => r.position.toLowerCase() === p.position!.toLowerCase()),
    );
    const ids = withReq.map((p) => p.id);
    const atts = ids.length
      ? await tx
          .select({
            workerId: trainingAttendance.workerId,
            passed: trainingAttendance.passed,
            date: trainingSession.date,
            courseId: trainingSession.courseId,
          })
          .from(trainingAttendance)
          .innerJoin(trainingSession, eq(trainingSession.id, trainingAttendance.sessionId))
          .where(
            and(
              eq(trainingAttendance.tenantId, tenantId),
              inArray(trainingAttendance.workerId, ids),
            ),
          )
      : [];
    return {
      requirements: reqs,
      rows: withReq.map((p) => ({
        workerId: p.id,
        name: p.fullName,
        position: p.position!,
        items: reqs
          .filter(
            (r) => r.position.toLowerCase() === p.position!.toLowerCase() && byId.has(r.courseId),
          )
          .map((r) => {
            const c = byId.get(r.courseId)!;
            const comp = competence(
              atts.filter((a) => a.workerId === p.id && a.courseId === r.courseId),
              c.validityMonths,
              t,
            );
            return { courseId: c.id, courseName: c.name, state: comp.state, dueDate: comp.dueDate };
          }),
      })),
    };
  });
}

export async function certificateData(tenantId: string, attendanceId: string) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const [r] = await tx
      .select({
        a: trainingAttendance,
        session: trainingSession,
        course: trainingCourse,
        name: worker.fullName,
        last4: worker.idLast4,
        idType: worker.idType,
      })
      .from(trainingAttendance)
      .innerJoin(trainingSession, eq(trainingSession.id, trainingAttendance.sessionId))
      .innerJoin(trainingCourse, eq(trainingCourse.id, trainingSession.courseId))
      .innerJoin(worker, eq(worker.id, trainingAttendance.workerId))
      .where(
        and(eq(trainingAttendance.id, attendanceId), eq(trainingAttendance.tenantId, tenantId)),
      );
    return r && r.a.passed !== false ? r : null;
  });
}
