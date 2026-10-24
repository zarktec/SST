import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { tenant } from "./tenancy";

/**
 * Documento controlado del SG-SST (política, procedimiento, programa, formato, manual…): lista maestra con versiones, aprobación
 * y vigencia. Los registros se conservan mínimo 20 años (Decreto 1072 de 2015, art. 2.2.4.6.13): nunca se borran. ♻
 */
export const document = pgTable(
  "document",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    code: text().notNull(),
    title: text().notNull(),
    /** policy | procedure | program | format | manual | other */
    kind: text().notNull(),
    ownerName: text(),
    /** Periodicidad de revisión en meses (nula = sin revisión periódica). */
    reviewMonths: integer(),
    /** Versión vigente (aprobada); nula mientras solo hay borradores. */
    currentVersionId: uuid(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("document_code_uq").on(t.tenantId, t.code),
    index("document_tenant_idx").on(t.tenantId, t.kind),
  ],
);

/**
 * Versión de un documento: borrador → aprobada (firma simple con evidencia y huella del contenido) → obsoleta. Una versión
 * aprobada es inmutable (trigger). ♻
 */
export const documentVersion = pgTable(
  "document_version",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    documentId: uuid()
      .notNull()
      .references(() => document.id),
    version: integer().notNull(),
    body: text().notNull(),
    changeNote: text(),
    /** draft | approved | obsolete */
    status: text().notNull().default("draft"),
    createdBy: text().notNull(),
    createdByName: text().notNull(),
    approvedBy: text(),
    approvedName: text(),
    approvedAt: timestamp({ withTimezone: true }),
    signature: text(),
    /** SHA-256 del contenido + datos de la firma. */
    evidenceHash: text(),
    effectiveFrom: date({ mode: "string" }),
    nextReviewOn: date({ mode: "string" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("document_version_uq").on(t.documentId, t.version),
    index("document_version_tenant_idx").on(t.tenantId, t.status),
  ],
);

/** Constancia de lectura y aceptación de una versión por una persona (p. ej. la política de SST). */
export const documentAck = pgTable(
  "document_ack",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    versionId: uuid()
      .notNull()
      .references(() => documentVersion.id),
    userId: text().notNull(),
    userName: text().notNull(),
    ackedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ip: text(),
  },
  (t) => [uniqueIndex("document_ack_uq").on(t.versionId, t.userId)],
);
