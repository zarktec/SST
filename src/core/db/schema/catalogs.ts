import {
  date,
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
import { catalogStatus } from "./enums";

/**
 * Catálogos normativos globales y versionados (spec 5.4): "toda la normativa es dato, no código".
 * Una versión publicada es inmutable (trigger); los cambios se hacen en un borrador nuevo y se
 * publican con fecha de vigencia y norma fuente. Los registros de las empresas guardan la versión
 * con la que se calcularon, para poder reproducir resultados históricos.
 */
export const catalogVersion = pgTable(
  "catalog_version",
  {
    id: id(),
    catalog: text().notNull(),
    version: integer().notNull(),
    status: catalogStatus().notNull().default("draft"),
    effectiveFrom: date({ mode: "string" }),
    effectiveTo: date({ mode: "string" }),
    sourceNorm: text().notNull().default(""),
    notes: text().notNull().default(""),
    createdBy: text(),
    publishedBy: text(),
    publishedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("catalog_version_uq").on(t.catalog, t.version),
    index("catalog_version_status_idx").on(t.catalog, t.status),
  ],
);

/** Elemento de un catálogo: `data` se valida contra el esquema del catálogo (ver definitions.ts). */
export const catalogItem = pgTable(
  "catalog_item",
  {
    id: id(),
    versionId: uuid()
      .notNull()
      .references(() => catalogVersion.id, { onDelete: "cascade" }),
    code: text().notNull(),
    data: jsonb().$type<Record<string, unknown>>().notNull(),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("catalog_item_code_uq").on(t.versionId, t.code),
    index("catalog_item_version_idx").on(t.versionId, t.sortOrder),
  ],
);
