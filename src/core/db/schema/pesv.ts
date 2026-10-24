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
import { tenant } from "./tenancy";
import { worker } from "./workers";

/** Vehículo del PESV (Resolución 40595 de 2022): documentación obligatoria con vencimiento (SOAT y revisión técnico-mecánica). */
export const pesvVehicle = pgTable(
  "pesv_vehicle",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    plate: text().notNull(),
    /** car | motorcycle | truck | bus | other */
    kind: text().notNull(),
    /** own | leased | contractor | employee */
    ownership: text().notNull().default("own"),
    description: text(),
    soatExpiresOn: date({ mode: "string" }),
    /** Revisión técnico-mecánica y de emisiones; nula si el vehículo aún está exento (vehículos nuevos). */
    rtmExpiresOn: date({ mode: "string" }),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("pesv_vehicle_tenant_idx").on(t.tenantId, t.active)],
);

/** Conductor: persona de la empresa con su licencia de conducción y vencimiento. */
export const pesvDriver = pgTable(
  "pesv_driver",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    workerId: uuid()
      .notNull()
      .references(() => worker.id),
    /** A1, A2, B1, B2, B3, C1, C2, C3 */
    licenseCategory: text().notNull(),
    licenseExpiresOn: date({ mode: "string" }).notNull(),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("pesv_driver_tenant_idx").on(t.tenantId, t.active)],
);

/** Inspección preoperacional de un vehículo, hecha por el conductor desde el celular. */
export const pesvPreop = pgTable(
  "pesv_preop",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    vehicleId: uuid()
      .notNull()
      .references(() => pesvVehicle.id),
    driverName: text().notNull(),
    performedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    odometer: integer(),
    results: jsonb()
      .$type<{ item: string; ok: boolean; critical: boolean; note: string | null }[]>()
      .notNull(),
    failCount: integer().notNull().default(0),
    notes: text(),
    createdAt: createdAt(),
  },
  (t) => [index("pesv_preop_idx").on(t.tenantId, t.vehicleId, t.performedAt)],
);

/** Siniestro vial. Registro ♻: no se borra. */
export const pesvCrash = pgTable(
  "pesv_crash",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    vehicleId: uuid().references(() => pesvVehicle.id),
    driverName: text().notNull(),
    occurredAt: timestamp({ withTimezone: true }).notNull(),
    place: text().notNull(),
    description: text().notNull(),
    injured: integer().notNull().default(0),
    fatalities: integer().notNull().default(0),
    /** yes | no | unknown — responsabilidad del conductor de la empresa */
    atFault: text().notNull().default("unknown"),
    createdAt: createdAt(),
  },
  (t) => [index("pesv_crash_idx").on(t.tenantId, t.occurredAt)],
);
