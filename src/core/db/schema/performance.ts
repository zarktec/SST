import {
  boolean,
  date,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { tenant } from "./tenancy";
import { worker } from "./workers";

/** Preferencias de la evaluación 360 de la empresa. `anonymous` es el valor con que se crean los ciclos nuevos. */
export const perfSettings = pgTable("perf_settings", {
  tenantId: uuid()
    .primaryKey()
    .references(() => tenant.id),
  anonymous: boolean().notNull().default(true),
  updatedBy: text(),
  updatedAt: updatedAt(),
});

/**
 * Ciclo de evaluación de desempeño 360 (formato F-RH-45). `anonymous` queda fijo al crear el ciclo (copia del ajuste de la
 * empresa) y `competencies` guarda una copia de las competencias vigentes, para que el ciclo no cambie si el catálogo cambia.
 */
export const perfCycle = pgTable(
  "perf_cycle",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    name: text().notNull(),
    dueOn: date({ mode: "string" }).notNull(),
    anonymous: boolean().notNull(),
    /** open | closed */
    status: text().notNull().default("open"),
    competencies: jsonb().notNull(),
    createdBy: text().notNull(),
    createdAt: createdAt(),
    closedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("perf_cycle_tenant_idx").on(t.tenantId, t.status)],
);

/** Persona evaluada dentro de un ciclo. */
export const perfSubject = pgTable(
  "perf_subject",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    cycleId: uuid()
      .notNull()
      .references(() => perfCycle.id),
    workerId: uuid()
      .notNull()
      .references(() => worker.id),
    /** Cargo al momento del ciclo. */
    position: text(),
    createdAt: createdAt(),
  },
  (t) => [unique("perf_subject_uq").on(t.cycleId, t.workerId)],
);

/**
 * Quién debe evaluar a quién y en qué nivel (upper | boss | peer). Solo dice si ya respondió: nunca apunta a la respuesta,
 * así en un ciclo anónimo nadie puede unir a la persona que evaluó con lo que respondió.
 */
export const perfAssignment = pgTable(
  "perf_assignment",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    cycleId: uuid()
      .notNull()
      .references(() => perfCycle.id),
    subjectId: uuid()
      .notNull()
      .references(() => perfSubject.id),
    level: text().notNull(),
    evaluatorWorkerId: uuid()
      .notNull()
      .references(() => worker.id),
    submittedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    unique("perf_assignment_uq").on(t.subjectId, t.level, t.evaluatorWorkerId),
    index("perf_assignment_evaluator_idx").on(t.tenantId, t.evaluatorWorkerId),
  ],
);

/** Calificaciones de un evaluador (competencia → 1..5). `evaluatorWorkerId` solo se guarda si el ciclo NO es anónimo. */
export const perfResponse = pgTable(
  "perf_response",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    cycleId: uuid()
      .notNull()
      .references(() => perfCycle.id),
    subjectId: uuid()
      .notNull()
      .references(() => perfSubject.id),
    level: text().notNull(),
    evaluatorWorkerId: uuid().references(() => worker.id),
    ratings: jsonb().notNull(),
    comment: text(),
    submittedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("perf_response_subject_idx").on(t.tenantId, t.subjectId)],
);
