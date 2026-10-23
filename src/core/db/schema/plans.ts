import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { PlanLimits } from "@/core/plans/modules";
import { createdAt, deletedAt, id, updatedAt } from "./_helpers";
import { billingPeriod, couponKind } from "./enums";

/**
 * Planes de la plataforma (100 % administrables por el SUPER ADMIN). Tablas globales: sin tenant_id
 * ni acceso para app_tenant. Los montos son enteros en centavos de COP.
 */
export const plan = pgTable(
  "plan",
  {
    id: id(),
    key: text().notNull().unique(),
    name: text().notNull(),
    description: text().notNull().default(""),
    /** Plan de prueba gratuita por defecto del registro (solo uno). */
    isTrial: boolean().notNull().default(false),
    /** Días de prueba; null = sin prueba. En el plan Free Trial es la duración del propio plan. */
    trialDays: integer(),
    /** IVA configurable: si aplica, si el precio ya lo incluye y su tarifa en puntos básicos (1900 = 19 %). */
    vatEnabled: boolean().notNull().default(false),
    vatIncluded: boolean().notNull().default(false),
    vatRateBp: integer().notNull().default(0),
    limits: jsonb().$type<PlanLimits>().notNull(),
    modules: text().array().notNull().default([]),
    visible: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex("plan_single_trial_uq")
      .on(t.isTrial)
      .where(sql`${t.isTrial} AND ${t.deletedAt} IS NULL`),
    check("plan_vat_rate_range", sql`${t.vatRateBp} BETWEEN 0 AND 10000`),
    check("plan_trial_days_range", sql`${t.trialDays} IS NULL OR ${t.trialDays} BETWEEN 0 AND 365`),
  ],
);

/** Un precio por periodicidad: un plan puede ofrecerse mensual, anual o ambos. */
export const planPrice = pgTable(
  "plan_price",
  {
    id: id(),
    planId: uuid()
      .notNull()
      .references(() => plan.id),
    period: billingPeriod().notNull(),
    amountCents: bigint({ mode: "bigint" }).notNull(),
    currency: text().notNull().default("COP"),
    /** Código del producto/servicio en Siigo para este plan y periodicidad (spec 5.8). */
    siigoProductCode: text(),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("plan_price_plan_period_uq").on(t.planId, t.period),
    check("plan_price_non_negative", sql`${t.amountCents} >= 0`),
  ],
);

export const coupon = pgTable(
  "coupon",
  {
    id: id(),
    code: text().notNull().unique(),
    description: text().notNull().default(""),
    kind: couponKind().notNull(),
    /** percent: puntos básicos (1000 = 10 %); amount: centavos de COP. */
    value: bigint({ mode: "bigint" }).notNull(),
    validFrom: timestamp({ withTimezone: true }),
    validTo: timestamp({ withTimezone: true }),
    maxUses: integer(),
    usedCount: integer().notNull().default(0),
    /** Restringe el cupón a estos planes (vacío = todos). */
    planIds: uuid().array().notNull().default([]),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("coupon_active_idx").on(t.active),
    check("coupon_value_positive", sql`${t.value} > 0`),
    check("coupon_percent_max", sql`${t.kind} <> 'percent' OR ${t.value} <= 10000`),
  ],
);
