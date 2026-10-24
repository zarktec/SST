import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { tenant } from "./tenancy";

/**
 * Notificación in-app de la empresa, generada por el barrido diario a partir de las alertas de los módulos. `key` es estable
 * (módulo + entidad): la misma alerta se actualiza y no se repite; al dejar de cumplirse se marca resuelta.
 */
export const notification = pgTable(
  "notification",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    key: text().notNull(),
    /** Módulo de permisos que debe poder ver la alerta (p. ej. incidents, emergencies). */
    module: text().notNull(),
    /** info | warning | critical */
    severity: text().notNull(),
    title: text().notNull(),
    detail: text(),
    href: text(),
    dueOn: text(),
    firstSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp({ withTimezone: true }),
    /** Cuándo se incluyó en un correo o push (para no repetirla a diario). */
    notifiedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("notification_key_uq").on(t.tenantId, t.key),
    index("notification_open_idx").on(t.tenantId, t.resolvedAt),
  ],
);

export const notificationRead = pgTable(
  "notification_read",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    notificationId: uuid()
      .notNull()
      .references(() => notification.id),
    userId: text().notNull(),
    readAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("notification_read_uq").on(t.notificationId, t.userId)],
);

/** Suscripción Web Push (PWA) de un usuario en un dispositivo. */
export const pushSubscription = pgTable(
  "push_subscription",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    userId: text().notNull(),
    endpoint: text().notNull(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    userAgent: text(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("push_subscription_uq").on(t.endpoint)],
);
