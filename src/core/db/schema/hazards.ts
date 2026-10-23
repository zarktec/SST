import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { catalogVersion } from "./catalogs";
import { tenant, workCenter } from "./tenancy";

/**
 * Matriz de identificación de peligros y valoración de riesgos (GTC 45), versionada por empresa. Una versión aprobada es
 * inmutable; los cambios (revisión anual, accidente grave o cambio en el proceso) crean una versión nueva desde la última.
 */
export const hazardMatrix = pgTable(
  "hazard_matrix",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    version: integer().notNull(),
    /** draft | approved | superseded */
    status: text().notNull().default("draft"),
    /** annual | serious_accident | change | initial */
    reason: text().notNull().default("initial"),
    /** Participación de los trabajadores en la identificación (quiénes y cómo). */
    participation: text(),
    scalesVersionId: uuid().references(() => catalogVersion.id),
    createdBy: text(),
    approvedBy: text(),
    approvedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("hazard_matrix_version_uq").on(t.tenantId, t.version),
    index("hazard_matrix_tenant_idx").on(t.tenantId, t.status),
  ],
);

export const hazardRow = pgTable(
  "hazard_row",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    matrixId: uuid()
      .notNull()
      .references(() => hazardMatrix.id),
    process: text().notNull(),
    activity: text().notNull(),
    task: text().notNull(),
    routine: boolean().notNull().default(true),
    workCenterId: uuid().references(() => workCenter.id),
    hazardFamily: text().notNull(),
    hazardName: text().notNull(),
    description: text(),
    effects: text(),
    existingSource: text(),
    existingMedium: text(),
    existingPerson: text(),
    exposedWorkers: integer().notNull().default(0),
    /** Niveles elegidos (nombre del nivel en las escalas GTC 45) y resultado de la valoración automática. */
    deficiency: text().notNull(),
    exposure: text().notNull(),
    consequence: text().notNull(),
    np: integer(),
    nr: integer(),
    probabilityLevel: text(),
    riskLevel: text(),
    acceptability: text(),
    /** Controles propuestos según la jerarquía. */
    ctrlElimination: text(),
    ctrlSubstitution: text(),
    ctrlEngineering: text(),
    ctrlAdmin: text(),
    ctrlEpp: text(),
    legalRequirement: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("hazard_row_matrix_idx").on(t.matrixId),
    index("hazard_row_tenant_idx").on(t.tenantId),
  ],
);
