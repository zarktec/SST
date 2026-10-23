import { pgEnum } from "drizzle-orm/pg-core";

export const tenantStatus = pgEnum("tenant_status", [
  "trial",
  "active",
  "past_due",
  "suspended",
  "cancelled",
]);
export const domainKind = pgEnum("domain_kind", ["subdomain", "custom"]);
export const domainStatus = pgEnum("domain_status", ["pending", "verified", "error"]);
export const platformRole = pgEnum("platform_role", ["SUPER_ADMIN", "SOPORTE_PLATAFORMA"]);
export const integrationEnv = pgEnum("integration_env", ["sandbox", "production"]);
export const membershipStatus = pgEnum("membership_status", ["active", "invited", "disabled"]);
export const permissionAction = pgEnum("permission_action", [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "export",
]);
export const permissionScope = pgEnum("permission_scope", ["all", "own", "team", "center"]);
