import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  bigint,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { tenant } from "./tenancy";

/**
 * Plan anual de trabajo del SG-SST (Decreto 1072 de 2015, art. 2.2.4.6.8 num. 5 y art. 2.2.4.6.17). Un plan por año;
 * lo firman el empleador y el responsable del SG-SST (firma electrónica simple: quién, cuándo y hash del contenido).
 */
export const annualPlan = pgTable(
  "annual_plan",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    year: integer().notNull(),
    /** draft | signed */
    status: text().notNull().default("draft"),
    employerSignedBy: text(),
    employerSignedAt: timestamp({ withTimezone: true }),
    responsibleSignedBy: text(),
    responsibleSignedAt: timestamp({ withTimezone: true }),
    /** SHA-256 del contenido (actividades) al firmar; cambia si el plan se modifica después. */
    contentHash: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("annual_plan_year_uq").on(t.tenantId, t.year)],
);

export const annualActivity = pgTable(
  "annual_activity",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    planId: uuid()
      .notNull()
      .references(() => annualPlan.id),
    /** P | H | V | A */
    phva: text().notNull(),
    title: text().notNull(),
    objective: text(),
    responsibleName: text(),
    startDate: date({ mode: "string" }).notNull(),
    endDate: date({ mode: "string" }).notNull(),
    resources: text(),
    budgetCents: bigint({ mode: "bigint" }),
    /** pending | in_progress | done | cancelled */
    status: text().notNull().default("pending"),
    completedAt: timestamp({ withTimezone: true }),
    evidence: text(),
    /** Origen sugerido: improvement | hazard | manual. Con `sourceId` evita duplicar sugerencias. */
    source: text().notNull().default("manual"),
    sourceId: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("annual_activity_plan_idx").on(t.planId),
    uniqueIndex("annual_activity_source_uq").on(t.planId, t.source, t.sourceId),
  ],
);
