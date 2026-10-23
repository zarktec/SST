import {
  boolean,
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { correctiveAction } from "./actions";
import { tenant, workCenter } from "./tenancy";

/**
 * Reporte de actos y condiciones inseguras (Decreto 1072 de 2015, art. 2.2.4.6.8 num. 5 y art. 2.2.4.6.15: identificación de
 * peligros con participación de los trabajadores). Cualquier miembro puede reportar, incluso de forma anónima: en ese caso no se
 * guarda quién lo hizo. Registro ♻: no se borra.
 */
export const unsafeReport = pgTable(
  "unsafe_report",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    /** act | condition */
    kind: text().notNull(),
    description: text().notNull(),
    place: text(),
    workCenterId: uuid().references(() => workCenter.id),
    /** low | medium | high — percepción de quien reporta; el revisor decide. */
    severity: text().notNull().default("medium"),
    latitude: doublePrecision(),
    longitude: doublePrecision(),
    anonymous: boolean().notNull().default(false),
    /** Nulo cuando el reporte es anónimo. */
    reportedBy: text(),
    /** new | actioned | dismissed */
    status: text().notNull().default("new"),
    reviewNote: text(),
    reviewedBy: text(),
    reviewedAt: timestamp({ withTimezone: true }),
    actionId: uuid().references(() => correctiveAction.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("unsafe_report_tenant_idx").on(t.tenantId, t.status, t.createdAt)],
);
