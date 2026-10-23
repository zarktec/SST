/**
 * Roles de sistema de cada empresa y permisos por defecto (módulo × acción × alcance).
 * Cada empresa puede ajustarlos (tabla role / role_permission). Los módulos nuevos de fases
 * posteriores se agregan aquí y en `PERMISSION_MODULES`.
 */
export const ACTIONS = ["view", "create", "edit", "delete", "approve", "export"] as const;
export type Action = (typeof ACTIONS)[number];
export type Scope = "all" | "own" | "team" | "center";

/** `company`: datos de la empresa, sedes, responsable del SG-SST y onboarding. */
export const ADMIN_MODULES = ["users", "billing", "branding", "domain", "company"] as const;

export const SST_MODULES = [
  "policy",
  "standards",
  "legal_matrix",
  "hazard_matrix",
  "annual_plan",
  "workers",
  "medical",
  "training",
  "ppe",
  "committees",
  "emergencies",
  "high_risk",
  "chemicals",
  "pesv",
  "incidents",
  "unsafe_reports",
  "inspections",
  "indicators",
  "audits",
  "management_review",
  "actions",
  "documents",
  "reports",
] as const;

/** `ccl` (convivencia) y `harassment` (acoso sexual) se tratan aparte: acceso restringido por diseño. */
export const RESTRICTED_MODULES = ["ccl", "harassment"] as const;

export const PERMISSION_MODULES = [
  ...ADMIN_MODULES,
  ...SST_MODULES,
  ...RESTRICTED_MODULES,
] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const SYSTEM_ROLES = [
  { key: "ADMIN_EMPRESA", name: "Administrador de la empresa" },
  { key: "ALTA_DIRECCION", name: "Alta dirección" },
  { key: "RESPONSABLE_SST", name: "Responsable del SG-SST" },
  { key: "APOYO_SST", name: "Apoyo SST" },
  { key: "MIEMBRO_COPASST", name: "Miembro COPASST / Vigía SST" },
  { key: "MIEMBRO_CCL", name: "Miembro del Comité de Convivencia" },
  { key: "JEFE_AREA", name: "Jefe de área" },
  { key: "BRIGADISTA", name: "Brigadista" },
  { key: "TRABAJADOR", name: "Trabajador" },
  { key: "CONTRATISTA", name: "Contratista" },
  { key: "AUDITOR_EXTERNO", name: "Auditor externo" },
] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLES)[number]["key"];

export type PermissionGrant = { module: PermissionModule; action: Action; scope: Scope };

const grant = (
  modules: readonly PermissionModule[],
  actions: readonly Action[],
  scope: Scope = "all",
): PermissionGrant[] =>
  modules.flatMap((module) => actions.map((action) => ({ module, action, scope })));

const SST_EXCEPT_SENSITIVE = SST_MODULES.filter((m) => m !== "medical");

/** Permisos por defecto de cada rol de sistema. TODO-NORMA: validar matriz con un experto SST. */
export function defaultPermissions(role: SystemRoleKey): PermissionGrant[] {
  switch (role) {
    case "ADMIN_EMPRESA":
      return [...grant(ADMIN_MODULES, ACTIONS), ...grant(SST_MODULES, ["view"])];
    case "ALTA_DIRECCION":
      return [
        ...grant(SST_MODULES, ["view", "export"]),
        ...grant(["policy", "annual_plan", "management_review", "documents"], ["approve"]),
        ...grant(["harassment"], ["view", "create", "edit"]),
      ];
    case "RESPONSABLE_SST":
      return [...grant(SST_MODULES, ACTIONS), ...grant(["company"], ["view", "edit"])];
    case "APOYO_SST":
      return grant(SST_MODULES, ["view", "create", "edit"]);
    case "MIEMBRO_COPASST":
      return [
        ...grant(SST_EXCEPT_SENSITIVE, ["view"]),
        ...grant(["unsafe_reports", "inspections", "committees"], ["create", "edit"]),
      ];
    case "MIEMBRO_CCL":
      return grant(["ccl"], ["view", "create", "edit"]);
    case "JEFE_AREA":
      return [
        ...grant(["workers", "incidents", "actions", "training"], ["view"], "team"),
        ...grant(["actions", "high_risk"], ["approve", "edit"], "team"),
        ...grant(["unsafe_reports", "incidents"], ["create"]),
      ];
    case "BRIGADISTA":
      return [...grant(["emergencies"], ["view"]), ...grant(["unsafe_reports"], ["create"])];
    case "TRABAJADOR":
      return [
        ...grant(["unsafe_reports", "incidents"], ["create"]),
        ...grant(["training", "ppe", "documents", "policy"], ["view"], "own"),
      ];
    case "CONTRATISTA":
      return [
        ...grant(["unsafe_reports"], ["create"]),
        ...grant(["documents", "training"], ["view"], "own"),
      ];
    case "AUDITOR_EXTERNO":
      return grant(SST_EXCEPT_SENSITIVE, ["view", "export"]);
  }
}
