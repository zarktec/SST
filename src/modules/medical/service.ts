import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { schema, withTenant, type Tx } from "@/core/db";
import { decrypt, encrypt } from "@/core/crypto/envelope";
import { assertWritable } from "@/core/plans/limits";
import { sendMail } from "@/core/mail";
import { todayYmd } from "@/lib/dates";
import { getActiveItems, getParameter } from "@/modules/platform/catalogs/service";
import {
  absenceSchema,
  absenteeismRate,
  adaptationDue,
  assertAllowedExamText,
  daysWithin,
  isMedicalCause,
  nextPeriodicDue,
  periodicState,
  resultSchema,
  returnEvaluationsNeeded,
  scheduleSchema,
  type AbsenceInput,
  type ResultInput,
  type ScheduleInput,
} from "./rules";

const {
  medicalEvaluation,
  jobAdaptationTask,
  absence,
  worker,
  sensitiveAccessLog,
  hazardMatrix,
  hazardRow,
  tenant,
} = schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });
const aad = (tenantId: string) => `medical:${tenantId}`;

export class MedicalError extends Error {}

export async function evalTypes() {
  const a = await getActiveItems<{ code: string; name: string }>("medical_eval_types");
  return (a?.items ?? []).map((i) => ({ code: i.code, name: i.name }));
}

async function logAccess(
  tx: Tx,
  tenantId: string,
  userId: string,
  entityId: string | null,
  reason: string,
) {
  await tx
    .insert(sensitiveAccessLog)
    .values({ tenantId, actorId: userId, entity: "medical_evaluation", entityId, reason });
}

/** Programa una evaluación. El texto libre se revisa para impedir pruebas discriminatorias (embarazo, VIH, serología). */
export async function scheduleEvaluation(tenantId: string, userId: string, input: ScheduleInput) {
  const d = scheduleSchema.parse(input);
  assertAllowedExamText(d.ipsName, d.requestNote, d.type);
  await assertWritable(tenantId);
  if (!(await evalTypes()).some((t) => t.code === d.type))
    throw new MedicalError("Tipo de evaluación no válido");
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [w] = await tx
      .select({ id: worker.id })
      .from(worker)
      .where(
        and(eq(worker.id, d.workerId), eq(worker.tenantId, tenantId), isNull(worker.deletedAt)),
      );
    if (!w) throw new MedicalError("Persona no encontrada");
    const [e] = await tx
      .insert(medicalEvaluation)
      .values({
        tenantId,
        workerId: d.workerId,
        type: d.type,
        scheduledDate: d.scheduledDate,
        ipsName: d.ipsName,
        createdBy: userId,
      })
      .returning({ id: medicalEvaluation.id });
    return e.id;
  });
}

/**
 * Registra el resultado: solo concepto, restricciones y recomendaciones (cifradas), IPS y costo. Si hay restricciones o
 * recomendaciones crea la tarea de adaptación del puesto (plazo parametrizable, 20 días). Si es periódica fija la siguiente.
 */
export async function recordResult(tenantId: string, userId: string, input: ResultInput) {
  const d = resultSchema.parse(input);
  assertAllowedExamText(d.restrictions, d.recommendations, d.ipsName);
  await assertWritable(tenantId);
  const [adaptDays, periodMonths] = await Promise.all([
    getParameter("medicina.adaptacion_puesto_dias", 20),
    getParameter("medicina.periodica_meses", 12),
  ]);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [e] = await tx
      .select()
      .from(medicalEvaluation)
      .where(
        and(eq(medicalEvaluation.id, d.evaluationId), eq(medicalEvaluation.tenantId, tenantId)),
      );
    if (!e) throw new MedicalError("Evaluación no encontrada");
    if (e.status === "done") throw new MedicalError("Esta evaluación ya tiene resultado");
    const hasFindings = Boolean(d.restrictions || d.recommendations);
    await tx
      .update(medicalEvaluation)
      .set({
        status: "done",
        performedDate: d.performedDate,
        concept: d.concept,
        restrictionsEncrypted: d.restrictions ? encrypt(d.restrictions, aad(tenantId)) : null,
        recommendationsEncrypted: d.recommendations
          ? encrypt(d.recommendations, aad(tenantId))
          : null,
        ipsName: d.ipsName ?? e.ipsName,
        costCents: d.costPesos === null ? null : BigInt(d.costPesos) * 100n,
        nextDueDate: e.type === "periodica" ? nextPeriodicDue(d.performedDate, periodMonths) : null,
        updatedAt: new Date(),
      })
      .where(eq(medicalEvaluation.id, e.id));
    let taskDue: string | null = null;
    if (hasFindings) {
      taskDue = adaptationDue(d.performedDate, adaptDays);
      await tx
        .insert(jobAdaptationTask)
        .values({ tenantId, evaluationId: e.id, workerId: e.workerId, dueDate: taskDue });
    }
    await logAccess(tx, tenantId, userId, e.id, "registro de resultado");
    return { taskDue };
  });
}

/** Lista sin datos de salud (solo concepto): la lectura del detalle descifrado queda registrada. */
export async function listEvaluations(tenantId: string, filter: { status?: string } = {}) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({
        id: medicalEvaluation.id,
        type: medicalEvaluation.type,
        status: medicalEvaluation.status,
        scheduledDate: medicalEvaluation.scheduledDate,
        performedDate: medicalEvaluation.performedDate,
        concept: medicalEvaluation.concept,
        ipsName: medicalEvaluation.ipsName,
        nextDueDate: medicalEvaluation.nextDueDate,
        costCents: medicalEvaluation.costCents,
        workerId: medicalEvaluation.workerId,
        workerName: worker.fullName,
      })
      .from(medicalEvaluation)
      .innerJoin(worker, eq(worker.id, medicalEvaluation.workerId))
      .where(
        and(
          eq(medicalEvaluation.tenantId, tenantId),
          filter.status ? eq(medicalEvaluation.status, filter.status) : undefined,
        ),
      )
      .orderBy(desc(medicalEvaluation.scheduledDate)),
  );
}

export async function getEvaluation(tenantId: string, userId: string, id: string) {
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [e] = await tx
      .select()
      .from(medicalEvaluation)
      .where(and(eq(medicalEvaluation.id, id), eq(medicalEvaluation.tenantId, tenantId)));
    if (!e) return null;
    await logAccess(tx, tenantId, userId, id, "lectura");
    const [w] = await tx
      .select({ name: worker.fullName })
      .from(worker)
      .where(eq(worker.id, e.workerId));
    return {
      ...e,
      restrictionsEncrypted: undefined,
      recommendationsEncrypted: undefined,
      workerName: w?.name ?? "",
      restrictions: e.restrictionsEncrypted
        ? decrypt(e.restrictionsEncrypted, aad(tenantId))
        : null,
      recommendations: e.recommendationsEncrypted
        ? decrypt(e.recommendationsEncrypted, aad(tenantId))
        : null,
    };
  });
}

/** Estado de la evaluación periódica por persona activa: al día, por vencer, vencida o sin programar. */
export async function periodicStatus(tenantId: string) {
  const [warn, months] = await Promise.all([
    getParameter("medicina.recordatorio_dias", 30),
    getParameter("medicina.periodica_meses", 12),
  ]);
  const t = todayYmd();
  return withTenant(ctxOf(tenantId), async (tx) => {
    const people = (
      await tx
        .select()
        .from(worker)
        .where(and(eq(worker.tenantId, tenantId), isNull(worker.deletedAt)))
    ).filter((p) => !p.endDate || p.endDate >= t);
    const evals = await tx
      .select()
      .from(medicalEvaluation)
      .where(
        and(
          eq(medicalEvaluation.tenantId, tenantId),
          inArray(medicalEvaluation.type, ["periodica", "preingreso"]),
        ),
      );
    return people.map((p) => {
      const mine = evals.filter((e) => e.workerId === p.id);
      const scheduled =
        mine
          .filter((e) => e.type === "periodica" && e.status === "scheduled")
          .map((e) => e.scheduledDate!)
          .sort()[0] ?? null;
      const lastDone =
        mine
          .filter((e) => e.status === "done" && e.performedDate)
          .map((e) => e.performedDate!)
          .sort()
          .at(-1) ?? p.startDate;
      const due =
        mine
          .filter((e) => e.type === "periodica" && e.status === "done")
          .map((e) => e.nextDueDate)
          .filter(Boolean)
          .sort()
          .at(-1) ?? nextPeriodicDue(lastDone, months);
      return {
        workerId: p.id,
        name: p.fullName,
        due,
        scheduled,
        state: periodicState(due, t, warn),
      };
    });
  });
}

export async function pendingReturnEvaluations(tenantId: string) {
  const threshold = await getParameter("medicina.retorno_ausencia_dias", 90);
  return withTenant(ctxOf(tenantId), async (tx) => {
    const abs = await tx.select().from(absence).where(eq(absence.tenantId, tenantId));
    const done = await tx
      .select({
        workerId: medicalEvaluation.workerId,
        performedDate: medicalEvaluation.performedDate,
      })
      .from(medicalEvaluation)
      .where(
        and(
          eq(medicalEvaluation.tenantId, tenantId),
          eq(medicalEvaluation.type, "retorno_laboral"),
          eq(medicalEvaluation.status, "done"),
        ),
      );
    const needed = returnEvaluationsNeeded(
      abs,
      done.map((d) => ({ workerId: d.workerId, performedDate: d.performedDate! })),
      threshold,
      todayYmd(),
    );
    const names = await tx
      .select({ id: worker.id, name: worker.fullName })
      .from(worker)
      .where(eq(worker.tenantId, tenantId));
    return needed.map((a) => ({
      ...a,
      workerName: names.find((n) => n.id === a.workerId)?.name ?? "",
    }));
  });
}

export async function listAdaptationTasks(tenantId: string) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const rows = await tx
      .select({ t: jobAdaptationTask, name: worker.fullName })
      .from(jobAdaptationTask)
      .innerJoin(worker, eq(worker.id, jobAdaptationTask.workerId))
      .where(eq(jobAdaptationTask.tenantId, tenantId))
      .orderBy(asc(jobAdaptationTask.dueDate));
    const t = todayYmd();
    return rows.map((r) => ({
      ...r.t,
      workerName: r.name,
      overdue: r.t.status === "open" && r.t.dueDate < t,
    }));
  });
}

export async function completeAdaptation(
  tenantId: string,
  userId: string,
  id: string,
  note: string,
) {
  if (note.trim().length < 3) throw new MedicalError("Describe la adaptación realizada");
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const r = await tx
      .update(jobAdaptationTask)
      .set({ status: "done", doneAt: new Date(), note: note.trim() })
      .where(and(eq(jobAdaptationTask.id, id), eq(jobAdaptationTask.tenantId, tenantId)))
      .returning({ id: jobAdaptationTask.id });
    if (!r.length) throw new MedicalError("Tarea no encontrada");
  });
}

/**
 * Envía a la IPS el perfil del cargo y los peligros de la matriz vigente (sin datos de salud). El texto indica explícitamente que
 * no se solicitan pruebas de embarazo, VIH ni serología.
 */
export async function sendProfileToIps(
  tenantId: string,
  userId: string,
  evaluationId: string,
  ipsEmail: string,
) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ipsEmail))
    throw new MedicalError("Correo de la IPS inválido");
  const data = await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [e] = await tx
      .select()
      .from(medicalEvaluation)
      .where(and(eq(medicalEvaluation.id, evaluationId), eq(medicalEvaluation.tenantId, tenantId)));
    if (!e) throw new MedicalError("Evaluación no encontrada");
    const [w] = await tx.select().from(worker).where(eq(worker.id, e.workerId));
    const [t] = await tx
      .select({ name: tenant.tradeName })
      .from(tenant)
      .where(eq(tenant.id, tenantId));
    const [m] = await tx
      .select()
      .from(hazardMatrix)
      .where(and(eq(hazardMatrix.tenantId, tenantId), eq(hazardMatrix.status, "approved")));
    const hazards = m
      ? (await tx.select().from(hazardRow).where(eq(hazardRow.matrixId, m.id))).filter(
          (h) => !h.workCenterId || h.workCenterId === w.workCenterId,
        )
      : [];
    return { e, w, company: t?.name ?? "", hazards };
  });
  const list = data.hazards
    .map(
      (h) =>
        `<li>${h.hazardFamily}: ${h.hazardName} (${h.process} / ${h.task})${h.riskLevel ? ` — riesgo ${h.riskLevel}` : ""}</li>`,
    )
    .join("");
  await sendMail({
    to: ipsEmail,
    subject: `Perfil del cargo para evaluación médica ocupacional — ${data.company}`,
    html: `<p>Evaluación: <strong>${data.e.type}</strong> programada para ${data.e.scheduledDate ?? "—"}.</p><p>Trabajador: <strong>${data.w.fullName}</strong>. Cargo: ${data.w.position ?? "—"}. Área: ${data.w.area ?? "—"}.</p><p>Peligros a los que está expuesto:</p><ul>${list || "<li>Sin matriz de peligros aprobada.</li>"}</ul><p>Los costos de la evaluación son asumidos por el empleador. <strong>No se solicitan ni se deben practicar pruebas de embarazo, VIH ni serología como requisito.</strong> Solo se espera el concepto de aptitud, las restricciones y las recomendaciones; no se solicita historia clínica.</p>`,
  });
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    logAccess(tx, tenantId, userId, evaluationId, "envío del perfil a la IPS"),
  );
}

// ---------- Ausentismo ----------

export async function addAbsence(tenantId: string, userId: string, input: AbsenceInput) {
  const d = absenceSchema.parse(input);
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [w] = await tx
      .select({ id: worker.id })
      .from(worker)
      .where(
        and(eq(worker.id, d.workerId), eq(worker.tenantId, tenantId), isNull(worker.deletedAt)),
      );
    if (!w) throw new MedicalError("Persona no encontrada");
    const [a] = await tx
      .insert(absence)
      .values({
        tenantId,
        workerId: d.workerId,
        cause: d.cause,
        startDate: d.startDate,
        endDate: d.endDate,
        estimatedCostCents: d.costPesos === null ? null : BigInt(d.costPesos) * 100n,
        note: d.note,
      })
      .returning({ id: absence.id });
    return a.id;
  });
}

export async function closeAbsence(tenantId: string, userId: string, id: string, endDate: string) {
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [a] = await tx
      .select()
      .from(absence)
      .where(and(eq(absence.id, id), eq(absence.tenantId, tenantId)));
    if (!a) throw new MedicalError("Ausencia no encontrada");
    if (endDate < a.startDate) throw new MedicalError("El fin no puede ser anterior al inicio");
    await tx.update(absence).set({ endDate, updatedAt: new Date() }).where(eq(absence.id, id));
  });
}

export async function listAbsences(tenantId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ a: absence, name: worker.fullName })
      .from(absence)
      .innerJoin(worker, eq(worker.id, absence.workerId))
      .where(eq(absence.tenantId, tenantId))
      .orderBy(desc(absence.startDate))
      .then((rows) =>
        rows.map((r) => ({ ...r.a, workerName: r.name, medical: isMedicalCause(r.a.cause) })),
      ),
  );
}

/** Ausentismo del periodo [from, to]: días perdidos por causa, costo estimado y tasa sobre los trabajadores activos. */
export async function absenteeismStats(tenantId: string, from: string, to: string) {
  const rows = await listAbsences(tenantId);
  const byCause = new Map<string, { days: number; cost: bigint; cases: number }>();
  let lost = 0;
  for (const a of rows) {
    const days = daysWithin(a, from, to);
    if (!days) continue;
    lost += days;
    const cur = byCause.get(a.cause) ?? { days: 0, cost: 0n, cases: 0 };
    cur.days += days;
    cur.cases += 1;
    cur.cost += a.estimatedCostCents ?? 0n;
    byCause.set(a.cause, cur);
  }
  const workers = await withTenant(ctxOf(tenantId), async (tx) => {
    const people = await tx
      .select()
      .from(worker)
      .where(and(eq(worker.tenantId, tenantId), isNull(worker.deletedAt)));
    return people.filter(
      (p) => p.kind !== "contractor" && (!p.endDate || p.endDate >= from) && p.startDate <= to,
    ).length;
  });
  const periodDays = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
  return {
    lostDays: lost,
    workers,
    periodDays,
    rate: absenteeismRate(lost, workers, periodDays),
    causes: [...byCause.entries()].map(([cause, v]) => ({ cause, ...v })),
  };
}
