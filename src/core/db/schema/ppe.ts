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
import { tenant } from "./tenancy";
import { worker } from "./workers";

/** Elemento de protección personal del catálogo de la empresa. */
export const ppeItem = pgTable(
  "ppe_item",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    name: text().notNull(),
    category: text(),
    /** Vida útil en meses: fecha de reposición = entrega + vida útil (null = no se repone por tiempo). */
    usefulLifeMonths: integer(),
    requiresSize: boolean().notNull().default(false),
    /** Alerta de inventario bajo. */
    minStock: integer().notNull().default(0),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("ppe_item_tenant_idx").on(t.tenantId)],
);

/** Matriz de EPP por cargo. */
export const ppeRequirement = pgTable(
  "ppe_requirement",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    position: text().notNull(),
    itemId: uuid()
      .notNull()
      .references(() => ppeItem.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("ppe_requirement_uq").on(t.tenantId, t.position, t.itemId)],
);

/** Ingreso de inventario (compras). El stock es ingresos menos entregas. */
export const ppeStockEntry = pgTable(
  "ppe_stock_entry",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    itemId: uuid()
      .notNull()
      .references(() => ppeItem.id),
    quantity: integer().notNull(),
    entryDate: date({ mode: "string" }).notNull(),
    supplier: text(),
    note: text(),
    registeredBy: text(),
    createdAt: createdAt(),
  },
  (t) => [index("ppe_stock_entry_item_idx").on(t.itemId)],
);

/** Entrega de EPP con firma del trabajador (firma electrónica simple: firma, fecha y hora, IP, dispositivo y huella). */
export const ppeDelivery = pgTable(
  "ppe_delivery",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    workerId: uuid()
      .notNull()
      .references(() => worker.id),
    itemId: uuid()
      .notNull()
      .references(() => ppeItem.id),
    quantity: integer().notNull().default(1),
    size: text(),
    /** first | replacement | loss | deterioration */
    reason: text().notNull().default("first"),
    deliveredAt: date({ mode: "string" }).notNull(),
    dueDate: date({ mode: "string" }),
    signatureData: text(),
    signedAt: timestamp({ withTimezone: true }),
    ip: text(),
    userAgent: text(),
    evidenceHash: text().notNull(),
    note: text(),
    registeredBy: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index("ppe_delivery_worker_idx").on(t.workerId, t.itemId),
    index("ppe_delivery_tenant_idx").on(t.tenantId, t.deliveredAt),
  ],
);
