import { index, pgTable, text, timestamp, uuid, date, integer } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { tenant } from "./tenancy";

/**
 * Acción correctiva, preventiva o de mejora (CAPA): módulo central que reciben inspecciones, accidentes, autoevaluación,
 * reportes de condiciones inseguras, auditorías, PVE, simulacros y quejas (Decreto 1072 de 2015, arts. 2.2.4.6.33 y 2.2.4.6.34).
 */
export const correctiveAction = pgTable(
  "corrective_action",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    /** corrective | preventive | improvement */
    type: text().notNull(),
    /** manual | incident | inspection | unsafe_report | assessment | audit | pve | drill | complaint */
    source: text().notNull().default("manual"),
    /** Identificador del origen (para no duplicar y poder navegar). */
    sourceId: text(),
    title: text().notNull(),
    description: text(),
    rootCause: text(),
    responsibleName: text(),
    dueDate: date({ mode: "string" }).notNull(),
    /** open | in_progress | done | verified | cancelled */
    status: text().notNull().default("open"),
    closureEvidence: text(),
    closedAt: timestamp({ withTimezone: true }),
    /** Verificación de eficacia posterior al cierre. */
    effective: text(),
    effectivenessNote: text(),
    verifiedAt: timestamp({ withTimezone: true }),
    /** Escalamiento automático de vencidas: nivel 0 = ninguno, aumenta con la mora. */
    escalationLevel: integer().notNull().default(0),
    escalatedAt: timestamp({ withTimezone: true }),
    createdBy: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("corrective_action_tenant_idx").on(t.tenantId, t.status, t.dueDate),
    index("corrective_action_source_idx").on(t.tenantId, t.source, t.sourceId),
  ],
);
