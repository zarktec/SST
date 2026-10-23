import { sql } from "drizzle-orm";
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
import { billingPeriod, couponKind, paymentStatus, subscriptionStatus } from "./enums";
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
 * Método de pago tokenizado en la pasarela. NUNCA se guardan datos de tarjeta: solo el id de la fuente de
 * pago, el tipo, la franquicia, los últimos 4 dígitos y el vencimiento (spec 5.7).
 */
export const paymentSource = pgTable(
  "payment_source",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    provider: text().notNull().default("wompi"),
    providerSourceId: text().notNull(),
    type: text().notNull(),
    brand: text(),
    last4: text(),
    expMonth: integer(),
    expYear: integer(),
    holder: text(),
    active: boolean().notNull().default(true),
    createdBy: text(),
    createdAt: createdAt(),
    deletedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("payment_source_provider_uq").on(t.provider, t.providerSourceId),
    index("payment_source_tenant_idx").on(t.tenantId),
  ],
);

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
    // Métodos de pago: predeterminado y de respaldo.
    defaultPaymentSourceId: uuid().references(() => paymentSource.id),
    backupPaymentSourceId: uuid().references(() => paymentSource.id),
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

/**
 * Cobros. Un registro por INTENTO: (suscripción, periodo, n.º de intento) es único y `reference` es única en la
 * pasarela (SUB-{suscripción}-{periodo} y sufijo -R2, -R3… en reintentos), lo que hace el cobro idempotente.
 * Montos en centavos (enteros).
 */
export const payment = pgTable(
  "payment",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    subscriptionId: uuid()
      .notNull()
      .references(() => subscription.id),
    planId: uuid()
      .notNull()
      .references(() => plan.id),
    period: billingPeriod().notNull(),
    /** Fecha (Colombia) del vencimiento que se cobra: identifica el ciclo de facturación. */
    periodKey: text().notNull(),
    attempt: integer().notNull().default(1),
    /** default | backup | manual (pago iniciado por la empresa con "Pagar ahora"). */
    sourceRole: text().notNull().default("default"),
    paymentSourceId: uuid().references(() => paymentSource.id),
    reference: text().notNull(),
    provider: text().notNull().default("wompi"),
    providerTxId: text(),
    status: paymentStatus().notNull().default("pending"),
    netCents: bigint({ mode: "bigint" }).notNull(),
    vatCents: bigint({ mode: "bigint" }).notNull(),
    totalCents: bigint({ mode: "bigint" }).notNull(),
    discountCents: bigint({ mode: "bigint" })
      .notNull()
      .default(sql`0`),
    currency: text().notNull().default("COP"),
    couponId: uuid().references(() => coupon.id),
    periodStart: timestamp({ withTimezone: true }),
    periodEnd: timestamp({ withTimezone: true }),
    declineReason: text(),
    nextRetryAt: timestamp({ withTimezone: true }),
    providerPayload: jsonb(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("payment_reference_uq").on(t.reference),
    uniqueIndex("payment_cycle_attempt_uq").on(t.subscriptionId, t.periodKey, t.attempt),
    index("payment_tenant_idx").on(t.tenantId, t.createdAt),
    index("payment_retry_idx").on(t.status, t.nextRetryAt),
    uniqueIndex("payment_provider_tx_uq").on(t.provider, t.providerTxId),
  ],
);

/** Eventos de la pasarela recibidos (idempotencia por checksum + auditoría). Global: sin acceso para empresas. */
export const webhookEvent = pgTable(
  "webhook_event",
  {
    id: id(),
    provider: text().notNull(),
    eventKey: text().notNull(),
    type: text().notNull(),
    payload: jsonb().notNull(),
    receivedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp({ withTimezone: true }),
    error: text(),
  },
  (t) => [uniqueIndex("webhook_event_uq").on(t.provider, t.eventKey)],
);
