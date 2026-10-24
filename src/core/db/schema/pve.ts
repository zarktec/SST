import { boolean, date, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { tenant } from "./tenancy";
import { worker } from "./workers";

/**
 * Programa de vigilancia epidemiológica (PVE): osteomuscular, auditivo, cardiovascular, visual o psicosocial. Define la población
 * objetivo y las actividades; los casos individuales son datos de salud (notas cifradas, lecturas registradas).
 */
export const pveProgram = pgTable(
  "pve_program",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    /** musculoskeletal | auditory | cardiovascular | visual | psychosocial */
    type: text().notNull(),
    name: text().notNull(),
    objective: text(),
    /** Descripción de la población objetivo (cargos, áreas, exposición). */
    population: text(),
    startedOn: date({ mode: "string" }).notNull(),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("pve_program_tenant_idx").on(t.tenantId, t.active)],
);

export const pveActivity = pgTable(
  "pve_activity",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    programId: uuid()
      .notNull()
      .references(() => pveProgram.id),
    description: text().notNull(),
    plannedOn: date({ mode: "string" }).notNull(),
    performedOn: date({ mode: "string" }),
    participants: integer(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("pve_activity_idx").on(t.programId, t.plannedOn)],
);

/** Caso de un trabajador dentro de un PVE. Registro ♻ de salud: nunca se borra. */
export const pveCase = pgTable(
  "pve_case",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    programId: uuid()
      .notNull()
      .references(() => pveProgram.id),
    workerId: uuid()
      .notNull()
      .references(() => worker.id),
    openedOn: date({ mode: "string" }).notNull(),
    /** low | medium | high */
    riskLevel: text().notNull().default("medium"),
    /** open | closed */
    status: text().notNull().default("open"),
    nextFollowUpOn: date({ mode: "string" }),
    /** Resumen del caso, cifrado (no es historia clínica). */
    notesEncrypted: text(),
    closedOn: date({ mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("pve_case_idx").on(t.tenantId, t.programId, t.status)],
);

export const pveFollowup = pgTable(
  "pve_followup",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    caseId: uuid()
      .notNull()
      .references(() => pveCase.id),
    performedOn: date({ mode: "string" }).notNull(),
    noteEncrypted: text().notNull(),
    nextFollowUpOn: date({ mode: "string" }),
    createdAt: createdAt(),
  },
  (t) => [index("pve_followup_idx").on(t.caseId, t.performedOn)],
);

/**
 * Aplicación de la batería de riesgo psicosocial (Resolución 2646 de 2008 y 2764 de 2022). La app NO aplica la batería: solo
 * registra quién la aplicó (psicólogo con licencia), cuándo y el nivel resultante, y programa la próxima. Registro ♻.
 */
export const psychosocialAssessment = pgTable(
  "psychosocial_assessment",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    appliedOn: date({ mode: "string" }).notNull(),
    psychologistName: text().notNull(),
    licenseNumber: text().notNull(),
    /** none | low | medium | high | very_high */
    riskLevel: text().notNull(),
    scope: text(),
    nextDueOn: date({ mode: "string" }).notNull(),
    notes: text(),
    createdAt: createdAt(),
  },
  (t) => [index("psychosocial_assessment_idx").on(t.tenantId, t.appliedOn)],
);
