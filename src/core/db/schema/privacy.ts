import {
  boolean,
  date,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id } from "./_helpers";
import { tenant } from "./tenancy";

/**
 * Autorización de tratamiento de datos personales por usuario y versión del aviso (Ley 1581 de 2012, art. 9 y 6: los datos
 * sensibles, como los de salud, requieren autorización expresa y separada). Registro ♻.
 */
export const dataConsent = pgTable(
  "data_consent",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    userId: text().notNull(),
    version: text().notNull(),
    /** Tratamiento de datos personales en general. */
    general: boolean().notNull(),
    /** Tratamiento de datos sensibles (salud). */
    sensitive: boolean().notNull(),
    acceptedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ip: text(),
    userAgent: text(),
  },
  (t) => [uniqueIndex("data_consent_uq").on(t.tenantId, t.userId, t.version)],
);

/** Solicitud de un titular: consulta, rectificación o supresión (Ley 1581 de 2012, arts. 14 y 15). Registro ♻. */
export const dataRequest = pgTable(
  "data_request",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    userId: text().notNull(),
    userName: text().notNull(),
    userEmail: text().notNull(),
    /** query | rectification | deletion */
    type: text().notNull(),
    detail: text().notNull(),
    /** Fecha máxima de respuesta (días hábiles parametrizados). */
    dueOn: date({ mode: "string" }).notNull(),
    /** open | resolved | rejected */
    status: text().notNull().default("open"),
    resolution: text(),
    resolvedBy: text(),
    resolvedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("data_request_tenant_idx").on(t.tenantId, t.status, t.createdAt)],
);
