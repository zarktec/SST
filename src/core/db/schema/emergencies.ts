import { boolean, date, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { tenant, workCenter } from "./tenancy";
import { worker } from "./workers";

/**
 * Plan de prevención, preparación y respuesta ante emergencias por sede (Decreto 1072 de 2015, art. 2.2.4.6.25). El análisis de
 * vulnerabilidad y los procedimientos operativos normalizados (PON) se redactan aquí; los planos de rutas de evacuación se
 * adjuntarán cuando haya almacenamiento de archivos. `workCenterId` nulo = plan general de la empresa.
 */
export const emergencyPlan = pgTable(
  "emergency_plan",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    workCenterId: uuid().references(() => workCenter.id),
    /** low | medium | high */
    vulnerability: text().notNull().default("medium"),
    vulnerabilityAnalysis: text().notNull(),
    pon: text(),
    evacuationRoutes: text(),
    reviewedOn: date({ mode: "string" }).notNull(),
    nextReviewOn: date({ mode: "string" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("emergency_plan_tenant_idx").on(t.tenantId, t.workCenterId)],
);

/** Brigada de emergencias: integrantes, capacitación y dotación. */
export const brigadeMember = pgTable(
  "brigade_member",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    workerId: uuid()
      .notNull()
      .references(() => worker.id),
    /** chief | first_aid | evacuation | fire */
    role: text().notNull(),
    joinedOn: date({ mode: "string" }).notNull(),
    lastTrainingOn: date({ mode: "string" }),
    dotation: text(),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("brigade_member_tenant_idx").on(t.tenantId, t.active)],
);

/** Extintores, botiquines, camillas y otros equipos de emergencia, con vencimiento e inspección periódica. */
export const emergencyAsset = pgTable(
  "emergency_asset",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    /** extinguisher | first_aid_kit | stretcher | other */
    kind: text().notNull(),
    code: text().notNull(),
    location: text().notNull(),
    workCenterId: uuid().references(() => workCenter.id),
    detail: text(),
    /** Recarga (extintor), vencimiento de contenido (botiquín) u otra fecha de vigencia. */
    expiresOn: date({ mode: "string" }),
    lastInspectedOn: date({ mode: "string" }),
    active: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("emergency_asset_tenant_idx").on(t.tenantId, t.active, t.kind)],
);

export const emergencyAssetInspection = pgTable(
  "emergency_asset_inspection",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    assetId: uuid()
      .notNull()
      .references(() => emergencyAsset.id),
    performedOn: date({ mode: "string" }).notNull(),
    ok: boolean().notNull(),
    note: text(),
    inspectorName: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("emergency_asset_inspection_idx").on(t.assetId, t.performedOn)],
);

/** Simulacro: planeación, ejecución, evaluación y acciones de mejora (mínimo uno al año). */
export const drill = pgTable(
  "drill",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    workCenterId: uuid().references(() => workCenter.id),
    scenario: text().notNull(),
    plannedOn: date({ mode: "string" }).notNull(),
    performedOn: date({ mode: "string" }),
    participants: integer(),
    evacuationMinutes: integer(),
    evaluation: text(),
    /** planned | done | cancelled */
    status: text().notNull().default("planned"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("drill_tenant_idx").on(t.tenantId, t.plannedOn)],
);
