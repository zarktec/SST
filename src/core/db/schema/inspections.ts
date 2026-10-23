import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { tenant, workCenter } from "./tenancy";

export type ChecklistItem = { id: string; text: string; required: boolean };
export type InspectionResult = {
  itemId: string;
  text: string;
  result: "ok" | "fail" | "na";
  note: string | null;
};

/**
 * Plantilla de lista de verificación de la empresa (propia o importada de la plantilla de plataforma `checklist_templates`).
 * Las inspecciones planeadas hacen parte del SG-SST (Decreto 1072 de 2015, art. 2.2.4.6.15 y 2.2.4.6.24).
 */
export const inspectionTemplate = pgTable(
  "inspection_template",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    name: text().notNull(),
    category: text().notNull(),
    items: jsonb().$type<ChecklistItem[]>().notNull(),
    /** Código de la plantilla de plataforma de la que se importó (si aplica). */
    catalogCode: text(),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("inspection_template_tenant_idx").on(t.tenantId, t.active)],
);

/**
 * Inspección realizada. Guarda una copia de los ítems de la plantilla (inmodificable aunque la plantilla cambie). `offlineId` lo
 * genera el dispositivo: reenviar la misma inspección tras una desconexión no la duplica. Registro ♻: no se borra.
 */
export const inspection = pgTable(
  "inspection",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    offlineId: text().notNull(),
    templateId: uuid().references(() => inspectionTemplate.id),
    templateName: text().notNull(),
    category: text().notNull(),
    place: text().notNull(),
    workCenterId: uuid().references(() => workCenter.id),
    inspectorName: text().notNull(),
    inspectorId: text(),
    /** Momento en que se hizo en el dispositivo (puede ser anterior al envío si estaba sin conexión). */
    performedAt: timestamp({ withTimezone: true }).notNull(),
    results: jsonb().$type<InspectionResult[]>().notNull(),
    okCount: integer().notNull().default(0),
    failCount: integer().notNull().default(0),
    notes: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("inspection_offline_uq").on(t.tenantId, t.offlineId),
    index("inspection_tenant_idx").on(t.tenantId, t.performedAt),
  ],
);
