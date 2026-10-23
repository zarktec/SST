import { date, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { tenant } from "./tenancy";

/**
 * Matriz legal de la empresa: sobre la matriz base del SUPER ADMIN (catálogos `legal_norms` y `legal_requirements`),
 * cada empresa marca qué le aplica y registra el cumplimiento con su evidencia. `kind`+`code` apuntan al elemento del catálogo.
 */
export const legalMatrixEntry = pgTable(
  "legal_matrix_entry",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    /** norm | requirement */
    kind: text().notNull(),
    code: text().notNull(),
    /** yes | no */
    applies: text().notNull(),
    justification: text(),
    /** pending | cumple | parcial | no_cumple (solo si aplica) */
    compliance: text().notNull().default("pending"),
    evidence: text(),
    responsibleName: text(),
    nextReviewDate: date({ mode: "string" }),
    notes: text(),
    reviewedBy: text(),
    reviewedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("legal_matrix_entry_uq").on(t.tenantId, t.kind, t.code),
    index("legal_matrix_entry_tenant_idx").on(t.tenantId),
  ],
);
