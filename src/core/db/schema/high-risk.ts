import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { tenant, workCenter } from "./tenancy";
import { worker } from "./workers";

export type PermitChecklistItem = {
  id: string;
  text: string;
  required: boolean;
  /** Respuesta en la solicitud: ok | fail | na (vacío mientras es plantilla). */
  answer?: "ok" | "fail" | "na";
};
export type PermitWorker = { workerId: string; name: string };

/**
 * Tipo de permiso de trabajo de alto riesgo, configurable por empresa (alturas, espacios confinados, trabajo en caliente,
 * trabajo eléctrico u otros). La lista de verificación es editable; los textos predeterminados son TODO-NORMA.
 */
export const permitType = pgTable(
  "permit_type",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    /** heights | confined | hot_work | electrical | other */
    kind: text().notNull(),
    name: text().notNull(),
    checklist: jsonb().$type<PermitChecklistItem[]>().notNull().default([]),
    /** Exige certificado vigente de cada trabajador y de un coordinador (trabajo en alturas, Res. 4272 de 2021). */
    requiresCertificate: boolean().notNull().default(false),
    requiresRescuePlan: boolean().notNull().default(false),
    /** Duración máxima del permiso, en horas (TODO-NORMA). */
    maxHours: integer().notNull().default(8),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("permit_type_tenant_idx").on(t.tenantId, t.active)],
);

/** Certificado de trabajo en alturas de un trabajador (nivel autorizado o coordinador), con vencimiento. */
export const heightCertificate = pgTable(
  "height_certificate",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    workerId: uuid()
      .notNull()
      .references(() => worker.id),
    /** authorized | coordinator */
    level: text().notNull(),
    issuer: text().notNull(),
    issuedOn: date({ mode: "string" }).notNull(),
    expiresOn: date({ mode: "string" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("height_certificate_idx").on(t.tenantId, t.workerId, t.expiresOn)],
);

/** Equipos de protección contra caídas y de rescate con certificación vigente. */
export const heightEquipment = pgTable(
  "height_equipment",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    code: text().notNull(),
    description: text().notNull(),
    certifiedUntil: date({ mode: "string" }),
    lastInspectedOn: date({ mode: "string" }),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("height_equipment_idx").on(t.tenantId, t.active)],
);

/**
 * Permiso de trabajo digital: solicitud firmada → autorización firmada (otra persona) → cierre. Guarda copia de la lista de
 * verificación con las respuestas y la evidencia de cada firma (huella SHA-256, fecha, IP y navegador). Registro ♻: no se borra.
 */
export const workPermit = pgTable(
  "work_permit",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    typeId: uuid()
      .notNull()
      .references(() => permitType.id),
    typeName: text().notNull(),
    requiresCertificate: boolean().notNull(),
    place: text().notNull(),
    workCenterId: uuid().references(() => workCenter.id),
    description: text().notNull(),
    validFrom: timestamp({ withTimezone: true }).notNull(),
    validUntil: timestamp({ withTimezone: true }).notNull(),
    checklist: jsonb().$type<PermitChecklistItem[]>().notNull(),
    workers: jsonb().$type<PermitWorker[]>().notNull(),
    coordinatorWorkerId: uuid().references(() => worker.id),
    rescuePlan: text(),
    /** requested | authorized | closed | cancelled */
    status: text().notNull().default("requested"),
    requestedBy: text().notNull(),
    requestedName: text().notNull(),
    requesterSignature: text().notNull(),
    requesterEvidence: text().notNull(),
    requestedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    authorizedBy: text(),
    authorizedName: text(),
    authorizerSignature: text(),
    authorizerEvidence: text(),
    authorizedAt: timestamp({ withTimezone: true }),
    closedBy: text(),
    closedAt: timestamp({ withTimezone: true }),
    closeNote: text(),
    cancelReason: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("work_permit_tenant_idx").on(t.tenantId, t.status, t.validFrom)],
);
