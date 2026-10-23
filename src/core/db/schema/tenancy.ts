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
import { createdAt, deletedAt, id, updatedAt } from "./_helpers";
import { user } from "./auth";
import {
  domainKind,
  domainStatus,
  membershipStatus,
  permissionAction,
  permissionScope,
  tenantStatus,
} from "./enums";

/** RLS: política por `id` (cada empresa solo ve su propia fila). */
export const tenant = pgTable("tenant", {
  id: id(),
  slug: text().notNull().unique(),
  legalName: text().notNull(),
  tradeName: text().notNull(),
  status: tenantStatus().notNull().default("trial"),
  nit: text(),
  nitDv: text(),
  ciiu: text(),
  riskClass: integer(),
  arl: text(),
  legalRepresentative: text(),
  /** Solo SSO (Google/Microsoft) para los usuarios de la empresa. */
  ssoOnly: boolean().notNull().default(false),
  /** Dominios de correo autorizados a ingresar sin invitación (spec 5.9). */
  allowedEmailDomains: text().array().notNull().default([]),
  /** Autoriza al soporte/SUPER ADMIN a ver datos sensibles (decisión del dueño del producto). */
  sensitiveAccessGrantedUntil: timestamp({ withTimezone: true }),
  retentionUntil: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  deletedAt: deletedAt(),
});

export const tenantDomain = pgTable(
  "tenant_domain",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    host: text().notNull(),
    kind: domainKind().notNull(),
    status: domainStatus().notNull().default("pending"),
    dnsRecords: jsonb().$type<{ type: string; name: string; value: string }[]>(),
    sslStatus: text(),
    lastError: text(),
    lastCheckedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("tenant_domain_host_uq").on(t.host),
    index("tenant_domain_tenant_idx").on(t.tenantId),
  ],
);

export const tenantBranding = pgTable("tenant_branding", {
  tenantId: uuid()
    .primaryKey()
    .references(() => tenant.id),
  logoLightUrl: text(),
  logoDarkUrl: text(),
  faviconUrl: text(),
  primary: text().notNull().default("#0f766e"),
  secondary: text().notNull().default("#1e293b"),
  accent: text().notNull().default("#f59e0b"),
  contrastReport: jsonb().$type<Record<string, { ratio: number; passesAA: boolean }>>(),
  updatedAt: updatedAt(),
});

export const workCenter = pgTable(
  "work_center",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    name: text().notNull(),
    address: text(),
    daneCityCode: text(),
    riskClass: integer(),
    workersCount: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("work_center_tenant_idx").on(t.tenantId)],
);

export const role = pgTable(
  "role",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    /** Clave de la plantilla de sistema (ADMIN_EMPRESA, RESPONSABLE_SST…) o null si es personalizado. */
    systemKey: text(),
    name: text().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("role_tenant_name_uq").on(t.tenantId, t.name)],
);

export const rolePermission = pgTable(
  "role_permission",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    roleId: uuid()
      .notNull()
      .references(() => role.id, { onDelete: "cascade" }),
    module: text().notNull(),
    action: permissionAction().notNull(),
    scope: permissionScope().notNull().default("all"),
  },
  (t) => [uniqueIndex("role_permission_uq").on(t.roleId, t.module, t.action)],
);

export const membership = pgTable(
  "membership",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    userId: text()
      .notNull()
      .references(() => user.id),
    roleId: uuid()
      .notNull()
      .references(() => role.id),
    status: membershipStatus().notNull().default("active"),
    /** Vínculo con la ficha del trabajador (Fase 2). */
    workerId: uuid(),
    /** Acceso temporal (AUDITOR_EXTERNO). */
    expiresAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("membership_tenant_user_uq").on(t.tenantId, t.userId),
    index("membership_user_idx").on(t.userId),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    email: text().notNull(),
    roleId: uuid()
      .notNull()
      .references(() => role.id),
    tokenHash: text().notNull().unique(),
    invitedBy: text().references(() => user.id),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    acceptedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("invitation_tenant_idx").on(t.tenantId)],
);

/** Archivos (Vercel Blob). Evidencias se vinculan por `evidence_link` (Fase 2). */
export const file = pgTable(
  "file",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    blobKey: text().notNull(),
    name: text().notNull(),
    mime: text().notNull(),
    size: integer().notNull(),
    sha256: text(),
    uploadedBy: text().references(() => user.id),
    createdAt: createdAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("file_tenant_idx").on(t.tenantId)],
);

/** Log inmutable (solo INSERT). tenant_id nulo = evento de plataforma. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    tenantId: uuid().references(() => tenant.id),
    actorId: text(),
    impersonatorId: text(),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: text(),
    before: jsonb(),
    after: jsonb(),
    ip: text(),
    userAgent: text(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_tenant_at_idx").on(t.tenantId, t.at)],
);

/** Registro de accesos a datos sensibles (salud, quejas de convivencia). Solo INSERT. */
export const sensitiveAccessLog = pgTable(
  "sensitive_access_log",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    actorId: text().notNull(),
    entity: text().notNull(),
    entityId: text(),
    reason: text(),
    at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sensitive_access_tenant_at_idx").on(t.tenantId, t.at)],
);
