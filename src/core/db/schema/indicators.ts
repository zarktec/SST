import { numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { id, updatedAt } from "./_helpers";
import { tenant } from "./tenancy";

/** Meta propia de la empresa para un indicador del catálogo (reemplaza la meta de la plataforma, si la hay). */
export const indicatorTarget = pgTable(
  "indicator_target",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    indicatorCode: text().notNull(),
    target: numeric({ precision: 14, scale: 4 }).notNull(),
    updatedBy: text(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("indicator_target_uq").on(t.tenantId, t.indicatorCode)],
);

/**
 * Análisis de resultados de un indicador en un periodo (Decreto 1072 de 2015, art. 2.2.4.6.20 y 2.2.4.6.22: los resultados se
 * analizan y alimentan la revisión por la dirección). `periodKey` = `<periodicidad>:<inicio del periodo>`.
 */
export const indicatorNote = pgTable(
  "indicator_note",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    indicatorCode: text().notNull(),
    periodKey: text().notNull(),
    analysis: text().notNull(),
    updatedBy: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("indicator_note_uq").on(t.tenantId, t.indicatorCode, t.periodKey)],
);
