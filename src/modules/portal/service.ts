import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { schema, withTenant } from "@/core/db";
import { currentPolicy, hasAcknowledged } from "@/modules/documents/service";
import { listEvaluations } from "@/modules/medical/service";
import { competenceMatrix } from "@/modules/training/service";
import { listReports } from "@/modules/unsafe-reports/service";

const { worker, trainingAttendance, trainingSession, trainingCourse, ppeDelivery, ppeItem } =
  schema;

/**
 * Datos del portal del trabajador. El usuario se vincula con su ficha de persona por el correo electrónico (sin distinguir
 * mayúsculas). Todo se filtra por esa persona: nunca se muestran datos de otros.
 */
export async function portalFor(tenantId: string, user: { id: string; email: string }) {
  const [w] = await withTenant({ tenantId }, (tx) =>
    tx
      .select()
      .from(worker)
      .where(
        and(
          eq(worker.tenantId, tenantId),
          isNull(worker.deletedAt),
          sql`lower(${worker.email}) = ${user.email.toLowerCase()}`,
        ),
      )
      .limit(1),
  );
  const policy = await currentPolicy(tenantId).catch(() => null);
  const policyAcked = policy?.current
    ? await hasAcknowledged(tenantId, user.id, policy.current.id)
    : false;
  const reports = await listReports(tenantId, { all: false, userId: user.id }).catch(() => []);
  if (!w)
    return {
      worker: null,
      policy,
      policyAcked,
      reports,
      trainings: [],
      required: [],
      ppe: [],
      evaluations: [],
    };

  const [attendance, required, ppe, evals] = await Promise.all([
    withTenant({ tenantId }, (tx) =>
      tx
        .select({
          date: trainingSession.date,
          course: trainingCourse.name,
          passed: trainingAttendance.passed,
          score: trainingAttendance.score,
        })
        .from(trainingAttendance)
        .innerJoin(trainingSession, eq(trainingSession.id, trainingAttendance.sessionId))
        .innerJoin(trainingCourse, eq(trainingCourse.id, trainingSession.courseId))
        .where(
          and(eq(trainingAttendance.tenantId, tenantId), eq(trainingAttendance.workerId, w.id)),
        )
        .orderBy(desc(trainingSession.date)),
    ),
    competenceMatrix(tenantId).then((m) => m.rows.find((r) => r.workerId === w.id)?.items ?? []),
    withTenant({ tenantId }, (tx) =>
      tx
        .select({
          item: ppeItem.name,
          deliveredAt: ppeDelivery.deliveredAt,
          dueDate: ppeDelivery.dueDate,
          quantity: ppeDelivery.quantity,
          size: ppeDelivery.size,
        })
        .from(ppeDelivery)
        .innerJoin(ppeItem, eq(ppeItem.id, ppeDelivery.itemId))
        .where(and(eq(ppeDelivery.tenantId, tenantId), eq(ppeDelivery.workerId, w.id)))
        .orderBy(desc(ppeDelivery.deliveredAt)),
    ),
    // Solo tipo, estado y fechas: el concepto, las restricciones y las recomendaciones se consultan con el médico/IPS.
    listEvaluations(tenantId).then((l) =>
      l
        .filter((e) => e.workerId === w.id)
        .map((e) => ({
          type: e.type,
          status: e.status,
          scheduledDate: e.scheduledDate,
          performedDate: e.performedDate,
          nextDueDate: e.nextDueDate,
        })),
    ),
  ]);
  return {
    worker: { id: w.id, name: w.fullName, position: w.position },
    policy,
    policyAcked,
    reports,
    trainings: attendance,
    required,
    ppe,
    evaluations: evals,
  };
}
