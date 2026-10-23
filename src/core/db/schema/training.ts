import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  date,
} from "drizzle-orm/pg-core";
import { createdAt, deletedAt, id, updatedAt } from "./_helpers";
import { tenant } from "./tenancy";
import { worker } from "./workers";

/** Curso del catálogo de la empresa (inducción, reinducción, específicos). */
export const trainingCourse = pgTable(
  "training_course",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    name: text().notNull(),
    /** induction | reinduction | specific | other */
    kind: text().notNull().default("specific"),
    durationHours: numeric({ precision: 6, scale: 2 }),
    description: text(),
    /** Meses de vigencia de lo aprendido (null = no vence). */
    validityMonths: integer(),
    /** Puntaje mínimo (0-100) de la evaluación para aprobar (null = sin evaluación o solo asistencia). */
    passScore: integer(),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("training_course_tenant_idx").on(t.tenantId)],
);

export type QuizOption = { text: string };
export const trainingQuestion = pgTable(
  "training_question",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    courseId: uuid()
      .notNull()
      .references(() => trainingCourse.id),
    question: text().notNull(),
    options: jsonb().$type<QuizOption[]>().notNull(),
    correctIndex: integer().notNull(),
    position: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("training_question_course_idx").on(t.courseId)],
);

export const trainingSession = pgTable(
  "training_session",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    courseId: uuid()
      .notNull()
      .references(() => trainingCourse.id),
    date: date({ mode: "string" }).notNull(),
    location: text(),
    trainer: text(),
    notes: text(),
    /** scheduled | open | closed */
    status: text().notNull().default("scheduled"),
    /** Token del QR de asistencia: solo existe mientras la sesión está abierta. */
    attendanceToken: text(),
    openedAt: timestamp({ withTimezone: true }),
    closedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("training_session_tenant_idx").on(t.tenantId, t.date),
    uniqueIndex("training_session_token_uq").on(t.attendanceToken),
  ],
);

/** Asistencia con firma electrónica simple (Ley 527 de 1999, Decreto 2364 de 2012): firma, fecha y hora, IP, dispositivo y huella. */
export const trainingAttendance = pgTable(
  "training_attendance",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    sessionId: uuid()
      .notNull()
      .references(() => trainingSession.id),
    workerId: uuid()
      .notNull()
      .references(() => worker.id),
    /** qr | manual */
    method: text().notNull(),
    signatureData: text(),
    signedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ip: text(),
    userAgent: text(),
    evidenceHash: text().notNull(),
    score: integer(),
    passed: boolean(),
    registeredBy: text(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("training_attendance_uq").on(t.sessionId, t.workerId),
    index("training_attendance_worker_idx").on(t.workerId),
  ],
);

/** Competencias requeridas por cargo: curso obligatorio para quienes ocupan ese cargo. */
export const positionRequirement = pgTable(
  "position_requirement",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    position: text().notNull(),
    courseId: uuid()
      .notNull()
      .references(() => trainingCourse.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("position_requirement_uq").on(t.tenantId, t.position, t.courseId)],
);
