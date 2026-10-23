import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { catalogVersion } from "./catalogs";
import { tenant } from "./tenancy";

/**
 * Autoevaluación de estándares mínimos (Resolución 0312 de 2019). Una por empresa y año. Al cerrarla queda como registro
 * histórico inmodificable (se conserva el catálogo vigente de ese momento).
 */
export const selfAssessment = pgTable(
  "self_assessment",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    year: integer().notNull(),
    /** Grupo de estándares aplicado (7, 21 o 60) al iniciarla. */
    standardsGroup: integer().notNull(),
    catalogVersionId: uuid().references(() => catalogVersion.id),
    /** draft | closed */
    status: text().notNull().default("draft"),
    scorePct: numeric({ precision: 6, scale: 2 }),
    ratingLevel: text(),
    closedAt: timestamp({ withTimezone: true }),
    closedBy: text(),
    /** Fecha en que se registró en la plataforma del Ministerio del Trabajo. */
    registeredMinistryAt: date({ mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("self_assessment_year_uq").on(t.tenantId, t.year),
    index("self_assessment_tenant_idx").on(t.tenantId),
  ],
);

export type ItemSnapshot = {
  phva: string;
  standardCode: string;
  standardName: string;
  criterion: string;
  verification: string;
};

export const selfAssessmentItem = pgTable(
  "self_assessment_item",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    assessmentId: uuid()
      .notNull()
      .references(() => selfAssessment.id),
    itemCode: text().notNull(),
    /** Copia del ítem del catálogo (el catálogo puede cambiar de versión sin alterar evaluaciones previas). */
    snapshot: jsonb().$type<ItemSnapshot>().notNull(),
    weight: numeric({ precision: 8, scale: 3 }).notNull(),
    /** pending | cumple | no_cumple | no_aplica */
    status: text().notNull().default("pending"),
    justification: text(),
    responsibleName: text(),
    observations: text(),
    /** Evidencia: descripción o enlace. TODO: adjuntos cuando haya almacenamiento de archivos. */
    evidence: text(),
    updatedBy: text(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("self_assessment_item_uq").on(t.assessmentId, t.itemCode),
    index("self_assessment_item_asm_idx").on(t.assessmentId),
  ],
);

/** Plan de mejoramiento: una acción por ítem que no cumple, generada al cerrar la autoevaluación. */
export const improvementItem = pgTable(
  "improvement_item",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    assessmentId: uuid()
      .notNull()
      .references(() => selfAssessment.id),
    itemCode: text().notNull(),
    description: text().notNull(),
    responsibleName: text(),
    dueDate: date({ mode: "string" }),
    /** open | in_progress | done */
    status: text().notNull().default("open"),
    closureNote: text(),
    closedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("improvement_item_uq").on(t.assessmentId, t.itemCode),
    index("improvement_item_tenant_idx").on(t.tenantId, t.status),
  ],
);
