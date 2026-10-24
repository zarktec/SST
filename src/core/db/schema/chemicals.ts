import { boolean, date, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { tenant, workCenter } from "./tenancy";

/**
 * Sustancia química del inventario (SGA, Decreto 1496 de 2018). Pictogramas GHS01–GHS09 de la clasificación SGA; la ficha de datos
 * de seguridad (FDS) se registra con su fecha de revisión (el archivo se adjuntará cuando haya almacenamiento).
 */
export const chemicalSubstance = pgTable(
  "chemical_substance",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    name: text().notNull(),
    casNumber: text(),
    supplier: text(),
    workCenterId: uuid().references(() => workCenter.id),
    /** Lugar de almacenamiento (bodega, gabinete…). Las incompatibilidades se evalúan entre sustancias del mismo lugar. */
    location: text().notNull(),
    quantity: text(),
    pictograms: text().array().notNull().default([]),
    /** danger | warning | none */
    signalWord: text().notNull().default("none"),
    hStatements: text(),
    sdsRevisedOn: date({ mode: "string" }),
    /** Fecha en que se verificó que el envase está rotulado según el SGA; nula = sin verificar. */
    labelCheckedOn: date({ mode: "string" }),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("chemical_substance_tenant_idx").on(t.tenantId, t.active, t.location)],
);
