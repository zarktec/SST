import { sql } from "drizzle-orm";
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
import { tenant } from "./tenancy";

/**
 * Responsable del SG-SST de la empresa (Decreto 1072 de 2015, art. 2.2.4.6.8 y Resolución 0312 de 2019).
 * Un registro vigente por empresa (histórico: los anteriores quedan con `active=false`, nunca se borran).
 */
export const sstResponsible = pgTable(
  "sst_responsible",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    fullName: text().notNull(),
    idType: text().notNull(),
    idNumber: text().notNull(),
    email: text().notNull(),
    phone: text(),
    /** Perfil profesional (p. ej. profesional, tecnólogo, técnico en SST). TODO-NORMA: validar perfil exigido. */
    profile: text().notNull(),
    licenseNumber: text(),
    licenseIssuer: text(),
    licenseValidUntil: date({ mode: "string" }),
    course50hDate: date({ mode: "string" }),
    course50hEntity: text(),
    /** Fecha de la última actualización de 20 horas (null = aún no se ha hecho). */
    refresher20hDate: date({ mode: "string" }),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("sst_responsible_tenant_idx").on(t.tenantId),
    // Solo un responsable activo por empresa.
    uniqueIndex("sst_responsible_active_uq")
      .on(t.tenantId)
      .where(sql`active`),
  ],
);

/** Avisos persistentes para la empresa (reclasificación, vencimientos…). Se muestran en el tablero hasta resolverse. */
export const tenantAlert = pgTable(
  "tenant_alert",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    kind: text().notNull(),
    message: text().notNull(),
    data: jsonb().$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    resolvedAt: timestamp({ withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (t) => [index("tenant_alert_tenant_idx").on(t.tenantId, t.resolvedAt)],
);
