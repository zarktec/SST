import { bigint, date, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { tenant } from "./tenancy";
import { worker } from "./workers";

/**
 * Evaluación médica ocupacional (Resolución 1843 de 2025). Solo el concepto de aptitud, restricciones y recomendaciones:
 * NUNCA historia clínica. Restricciones y recomendaciones van cifradas (dato sensible de salud) y cada lectura se registra.
 */
export const medicalEvaluation = pgTable(
  "medical_evaluation",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    workerId: uuid()
      .notNull()
      .references(() => worker.id),
    /** Código del catálogo `medical_eval_types` (preingreso, periodica, egreso…). */
    type: text().notNull(),
    scheduledDate: date({ mode: "string" }),
    performedDate: date({ mode: "string" }),
    ipsName: text(),
    /** apto | apto_restricciones | aplazado | no_apto (no_apto solo si el concepto lo emite el médico) */
    concept: text(),
    restrictionsEncrypted: text(),
    recommendationsEncrypted: text(),
    /** Costo asumido por el empleador, en centavos. */
    costCents: bigint({ mode: "bigint" }),
    /** Próxima evaluación periódica (si aplica). */
    nextDueDate: date({ mode: "string" }),
    /** scheduled | done | cancelled */
    status: text().notNull().default("scheduled"),
    createdBy: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("medical_evaluation_tenant_idx").on(t.tenantId, t.status),
    index("medical_evaluation_worker_idx").on(t.workerId, t.type),
  ],
);

/** Tarea de adaptación del puesto por recomendaciones o restricciones (plazo parametrizable, 20 días por defecto). */
export const jobAdaptationTask = pgTable(
  "job_adaptation_task",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    evaluationId: uuid()
      .notNull()
      .references(() => medicalEvaluation.id),
    workerId: uuid()
      .notNull()
      .references(() => worker.id),
    dueDate: date({ mode: "string" }).notNull(),
    /** open | done */
    status: text().notNull().default("open"),
    doneAt: timestamp({ withTimezone: true }),
    note: text(),
    createdAt: createdAt(),
  },
  (t) => [index("job_adaptation_tenant_idx").on(t.tenantId, t.status)],
);

/** Ausentismo e incapacidades por causa, con días y costo estimado. */
export const absence = pgTable(
  "absence",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    workerId: uuid()
      .notNull()
      .references(() => worker.id),
    /** common_illness | work_accident | occupational_disease | maternity | paternity | license | other */
    cause: text().notNull(),
    startDate: date({ mode: "string" }).notNull(),
    /** Null mientras la ausencia sigue en curso. */
    endDate: date({ mode: "string" }),
    estimatedCostCents: bigint({ mode: "bigint" }),
    note: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("absence_tenant_idx").on(t.tenantId, t.startDate),
    index("absence_worker_idx").on(t.workerId),
  ],
);
