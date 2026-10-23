import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, deletedAt, id, updatedAt } from "./_helpers";
import { tenant, workCenter } from "./tenancy";

/**
 * Trabajador, aprendiz o contratista. Registro ♻: se conserva mínimo 20 años desde el retiro (Decreto 1072 de 2015,
 * art. 2.2.4.6.13), por eso solo hay borrado lógico. El documento va cifrado; `idBlind` permite buscar y evitar duplicados.
 */
export const worker = pgTable(
  "worker",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    /** employee | apprentice | contractor */
    kind: text().notNull(),
    idType: text().notNull(),
    idEncrypted: text().notNull(),
    idBlind: text().notNull(),
    /** Últimos 4 dígitos para mostrar sin descifrar. */
    idLast4: text().notNull(),
    fullName: text().notNull(),
    email: text(),
    phone: text(),
    position: text(),
    area: text(),
    workCenterId: uuid().references(() => workCenter.id),
    /** indefinido | fijo | obra_labor | prestacion_servicios | aprendizaje | otro */
    contractType: text(),
    startDate: date({ mode: "string" }).notNull(),
    endDate: date({ mode: "string" }),
    eps: text(),
    afp: text(),
    arl: text(),
    arlRiskClass: integer(),
    ccf: text(),
    /** Empresa contratista a la que pertenece (solo kind = contractor). */
    contractorCompany: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex("worker_tenant_id_uq")
      .on(t.tenantId, t.idBlind)
      .where(sql`deleted_at is null`),
    index("worker_tenant_idx").on(t.tenantId, t.kind),
  ],
);

/** Verificación mensual del pago de seguridad social de un contratista (periodo AAAA-MM). */
export const contractorSsCheck = pgTable(
  "contractor_ss_check",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    workerId: uuid()
      .notNull()
      .references(() => worker.id),
    period: text().notNull(),
    paid: boolean().notNull(),
    note: text(),
    verifiedBy: text(),
    verifiedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("contractor_ss_check_uq").on(t.workerId, t.period)],
);
