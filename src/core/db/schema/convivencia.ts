import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { committee } from "./committees";
import { tenant, workCenter } from "./tenancy";
import { worker } from "./workers";

/**
 * Queja de acoso laboral para el Comité de Convivencia (Ley 1010 de 2006; Resolución 3461 de 2025). Confidencial: el relato va
 * cifrado y solo lo ven los miembros activos del comité; cada lectura queda en `sensitive_access_log`.
 */
export const cclComplaint = pgTable(
  "ccl_complaint",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    committeeId: uuid().references(() => committee.id),
    workCenterId: uuid().references(() => workCenter.id),
    /** Null si la queja es anónima. */
    complainantWorkerId: uuid().references(() => worker.id),
    /** Persona a la que se refiere la queja (si se identifica). */
    respondentWorkerId: uuid().references(() => worker.id),
    narrativeEncrypted: text().notNull(),
    /** received | summoned | hearing | agreement | no_agreement | follow_up | closed | referred */
    stage: text().notNull().default("received"),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    stageDueAt: timestamp({ withTimezone: true }),
    closedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("ccl_complaint_tenant_idx").on(t.tenantId, t.stage),
    index("ccl_complaint_complainant_idx").on(t.complainantWorkerId),
    index("ccl_complaint_respondent_idx").on(t.respondentWorkerId),
  ],
);

/** Trazabilidad de cada paso del trámite (nota cifrada). Solo inserción. */
export const cclComplaintEvent = pgTable(
  "ccl_complaint_event",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    complaintId: uuid()
      .notNull()
      .references(() => cclComplaint.id),
    stage: text().notNull(),
    noteEncrypted: text(),
    actorId: text().notNull(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ccl_complaint_event_idx").on(t.complaintId, t.at)],
);

/**
 * Canal separado para acoso sexual y violencia de género (Ley 2365 de 2024): lo reciben la alta dirección o talento
 * humano, nunca el Comité de Convivencia. Relato cifrado y acceso registrado.
 */
export const harassmentReport = pgTable(
  "harassment_report",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    reporterWorkerId: uuid().references(() => worker.id),
    narrativeEncrypted: text().notNull(),
    /** received | in_review | referred | closed */
    status: text().notNull().default("received"),
    noteEncrypted: text(),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp({ withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (t) => [index("harassment_report_tenant_idx").on(t.tenantId, t.status)],
);
