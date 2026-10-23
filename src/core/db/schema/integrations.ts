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
import { integrationEnv } from "./enums";

/**
 * Centro de integraciones (SUPER ADMIN). Tablas globales: sin acceso para app_tenant.
 * Claves: wompi, siigo, auco, google, microsoft.
 */
export const integration = pgTable("integration", {
  id: id(),
  key: text().notNull().unique(),
  activeEnv: integrationEnv().notNull().default("sandbox"),
  enabled: boolean().notNull().default(false),
  lastTestAt: timestamp({ withTimezone: true }),
  lastTestOk: boolean(),
  lastTestMessage: text(),
  consecutiveFailures: integer().notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Configuración NO secreta por ambiente (URLs base, IDs, flags). */
export const integrationConfig = pgTable(
  "integration_config",
  {
    id: id(),
    integrationId: uuid()
      .notNull()
      .references(() => integration.id, { onDelete: "cascade" }),
    env: integrationEnv().notNull(),
    values: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("integration_config_uq").on(t.integrationId, t.env)],
);

/** Secretos cifrados (sobre AES-256-GCM). `mask` es lo único que se muestra en la UI. */
export const integrationSecret = pgTable(
  "integration_secret",
  {
    id: id(),
    integrationId: uuid()
      .notNull()
      .references(() => integration.id, { onDelete: "cascade" }),
    env: integrationEnv().notNull(),
    name: text().notNull(),
    encrypted: text().notNull(),
    mask: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }),
    updatedBy: text(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("integration_secret_uq").on(t.integrationId, t.env, t.name)],
);

/** Historial: quién cambió qué y cuándo. Nunca guarda el valor. */
export const integrationChangeLog = pgTable(
  "integration_change_log",
  {
    id: id(),
    integrationId: uuid()
      .notNull()
      .references(() => integration.id, { onDelete: "cascade" }),
    env: integrationEnv(),
    field: text().notNull(),
    action: text().notNull(),
    actorId: text(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("integration_change_log_idx").on(t.integrationId, t.at)],
);
