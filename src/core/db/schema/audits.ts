import { date, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { tenant } from "./tenancy";

export type AuditItem = {
  id: string;
  text: string;
  /** conforms | minor_nc | major_nc | observation | na — vacío mientras no se evalúa. */
  result?: "conforms" | "minor_nc" | "major_nc" | "observation" | "na";
  note?: string;
};

/**
 * Auditoría interna del SG-SST (Decreto 1072 de 2015, art. 2.2.4.6.29): programa anual, lista de verificación, hallazgos e informe,
 * con participación del COPASST o Vigía. Los hallazgos no conformes y las observaciones se vuelven acciones (CAPA) al cerrarla.
 * Registro ♻: no se borra.
 */
export const audit = pgTable(
  "audit",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    year: integer().notNull(),
    title: text().notNull(),
    scope: text(),
    plannedOn: date({ mode: "string" }).notNull(),
    performedOn: date({ mode: "string" }),
    auditorName: text(),
    /** Integrante del COPASST o Vigía que participó. */
    committeeParticipant: text(),
    checklist: jsonb().$type<AuditItem[]>().notNull(),
    report: text(),
    /** planned | in_progress | closed | cancelled */
    status: text().notNull().default("planned"),
    closedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("audit_tenant_idx").on(t.tenantId, t.year, t.status)],
);

export type ReviewInputs = {
  generatedAt: string;
  accidents: { total: number; fatal: number; incidents: number };
  indicators: { name: string; value: number | null; target: number | null }[];
  audits: { title: string; status: string; findings: number }[];
  actions: { open: number; overdue: number; awaitingVerification: number; total: number };
  standards: { year: number; scorePct: number | null; level: string | null } | null;
  annualPlan: { total: number; done: number; pct: number } | null;
};

/**
 * Revisión por la alta dirección (Decreto 1072 de 2015, art. 2.2.4.6.31): entradas del sistema (instantánea al generarla) más las
 * que se digitan, conclusiones, decisiones y firma de la alta dirección. Firmada queda inmodificable. Registro ♻.
 */
export const managementReview = pgTable(
  "management_review",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    year: integer().notNull(),
    heldOn: date({ mode: "string" }).notNull(),
    attendees: text().notNull(),
    inputs: jsonb().$type<ReviewInputs>().notNull(),
    legalChanges: text(),
    stakeholderComms: text(),
    objectivesCompliance: text(),
    conclusions: text(),
    decisions: text(),
    /** draft | signed */
    status: text().notNull().default("draft"),
    signedBy: text(),
    signedName: text(),
    signature: text(),
    evidenceHash: text(),
    signedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("management_review_tenant_idx").on(t.tenantId, t.year)],
);
