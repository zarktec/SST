import {
  boolean,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { tenant, workCenter } from "./tenancy";
import { worker } from "./workers";

/**
 * Accidente o incidente de trabajo. Reporte a la ARL y a la EPS dentro de 2 días hábiles (Resolución 156 de 2005, art. 3);
 * investigación dentro de los 15 días siguientes (Resolución 1401 de 2007, art. 7). Registro ♻: no se borra.
 */
export const incident = pgTable(
  "incident",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    /** accident | incident */
    kind: text().notNull(),
    workerId: uuid().references(() => worker.id),
    /** Nombre de la persona cuando no está registrada (visitante, contratista externo). */
    affectedName: text(),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    place: text().notNull(),
    workCenterId: uuid().references(() => workCenter.id),
    activity: text(),
    description: text().notNull(),
    bodyPart: text(),
    injuryType: text(),
    /** none | minor | serious | fatal  (sin lesión, leve, grave, mortal) */
    severity: text().notNull().default("none"),
    witnesses: text(),
    /** Cuándo supo la empresa del evento: desde ahí corren los 2 días hábiles. */
    knownAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    arlDeadline: date({ mode: "string" }),
    arlReportedAt: date({ mode: "string" }),
    epsReportedAt: date({ mode: "string" }),
    arlReportNumber: text(),
    /** reported | investigating | closed */
    status: text().notNull().default("reported"),
    reportedBy: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("incident_tenant_idx").on(t.tenantId, t.status, t.occurredAt),
    index("incident_worker_idx").on(t.workerId),
  ],
);

export type TeamMember = { name: string; role: "copasst" | "sst" | "boss" | "licensed" | "other" };
export const incidentInvestigation = pgTable(
  "incident_investigation",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    incidentId: uuid()
      .notNull()
      .references(() => incident.id),
    deadline: date({ mode: "string" }).notNull(),
    team: jsonb().$type<TeamMember[]>().notNull().default([]),
    /** five_whys | cause_tree */
    method: text().notNull().default("five_whys"),
    /** five_whys: string[]; cause_tree: {id, text, parentId}[] */
    analysis: jsonb().$type<unknown>(),
    immediateCauses: text(),
    basicCauses: text(),
    conclusions: text(),
    completedAt: timestamp({ withTimezone: true }),
    remittedArlAt: date({ mode: "string" }),
    lessonsLearned: text(),
    lessonsDisclosedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("incident_investigation_uq").on(t.incidentId)],
);

/** Caso de enfermedad laboral: calificación y seguimiento. Base de la prevalencia e incidencia (Res. 0312, art. 30). */
export const occupationalDisease = pgTable(
  "occupational_disease",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    workerId: uuid()
      .notNull()
      .references(() => worker.id),
    diagnosis: text().notNull(),
    detectedOn: date({ mode: "string" }).notNull(),
    /** pending | occupational | common */
    qualification: text().notNull().default("pending"),
    qualifiedOn: date({ mode: "string" }),
    qualifiedBy: text(),
    followUp: text(),
    /** Caso nuevo en el periodo (incidencia) vs. caso existente (prevalencia). */
    isNew: boolean().notNull().default(true),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("occupational_disease_tenant_idx").on(t.tenantId, t.detectedOn)],
);
