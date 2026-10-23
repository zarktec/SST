import {
  bigint,
  boolean,
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
import { billingPeriod, couponKind, subscriptionStatus } from "./enums";
import { coupon, plan } from "./plans";
import { tenant } from "./tenancy";

/** Festivos de Colombia (editable por el SUPER ADMIN; se siembra con el cálculo de Ley Emiliani). */
export const holiday = pgTable("holiday", {
  date: date({ mode: "string" }).primaryKey(),
  name: text().notNull(),
  year: integer().notNull(),
  source: text().notNull().default("calculado"),
});

/** Parámetros globales de plataforma (días de gracia, retención, reintentos…). */
export const platformSetting = pgTable("platform_setting", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedBy: text(),
  updatedAt: updatedAt(),
});

/**
 * Suscripción de una empresa (una por empresa). Tiene tenant_id + RLS: la empresa solo la LEE; las
 * escrituras las hace la plataforma. Guarda un snapshot del precio: un cambio de precio del plan no
 * afecta a la suscripción hasta su renovación (salvo que el SUPER ADMIN lo fuerce).
 */
export const subscription = pgTable(
  "subscription",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    planId: uuid()
      .notNull()
      .references(() => plan.id),
    period: billingPeriod(),
    status: subscriptionStatus().notNull(),
    trialEndsAt: timestamp({ withTimezone: true }),
    currentPeriodStart: timestamp({ withTimezone: true }),
    currentPeriodEnd: timestamp({ withTimezone: true }),
    graceEndsAt: timestamp({ withTimezone: true }),
    cancelAtPeriodEnd: boolean().notNull().default(false),
    cancelledAt: timestamp({ withTimezone: true }),
    // Snapshot de precio (centavos) e IVA vigentes para esta suscripción.
    priceAmountCents: bigint({ mode: "bigint" }),
    vatEnabled: boolean().notNull().default(false),
    vatIncluded: boolean().notNull().default(false),
    vatRateBp: integer().notNull().default(0),
    couponId: uuid().references(() => coupon.id),
    couponKind: couponKind(),
    couponValue: bigint({ mode: "bigint" }),
    // Cambio programado (bajar de plan o de anual a mensual aplica al final del periodo).
    scheduledPlanId: uuid().references(() => plan.id),
    scheduledPeriod: billingPeriod(),
    // Métodos de pago (FK a payment_source se agrega en el paso de Wompi).
    defaultPaymentSourceId: uuid(),
    backupPaymentSourceId: uuid(),
    /** Recordatorios de fin de trial ya enviados: [7,3,1,0]. */
    trialRemindersSent: integer().array().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("subscription_tenant_uq").on(t.tenantId),
    index("subscription_status_idx").on(t.status, t.currentPeriodEnd),
  ],
);

/** Historial del ciclo de vida (auditable). Solo INSERT. */
export const subscriptionEvent = pgTable(
  "subscription_event",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    subscriptionId: uuid()
      .notNull()
      .references(() => subscription.id),
    type: text().notNull(),
    fromStatus: subscriptionStatus(),
    toStatus: subscriptionStatus(),
    data: jsonb(),
    actorId: text(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("subscription_event_tenant_idx").on(t.tenantId, t.at)],
);
