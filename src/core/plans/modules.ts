/**
 * Módulos habilitables por plan (feature flags). Los planes guardan una lista de estas claves.
 * `pesv` y `verificacion_identidad` son opcionales por plan (spec 6.3 y decisión del dueño: AUCO es un complemento de pago).
 */
export const PLAN_MODULES = [
  { key: "planear", label: "Planear (política, estándares, matrices, plan anual)" },
  { key: "hacer", label: "Hacer (personas, medicina, capacitación, comités, emergencias)" },
  { key: "verificar", label: "Verificar (accidentes, inspecciones, indicadores, auditoría)" },
  { key: "actuar", label: "Actuar (acciones correctivas y preventivas)" },
  { key: "documentos", label: "Gestión documental y firma electrónica" },
  { key: "reportes", label: "Reportes regulatorios y carpeta de inspección" },
  { key: "portal_trabajador", label: "Portal del trabajador" },
  { key: "pesv", label: "PESV (plan estratégico de seguridad vial)" },
  { key: "verificacion_identidad", label: "Verificación de identidad (AUCO)" },
] as const;

export type PlanModuleKey = (typeof PLAN_MODULES)[number]["key"];
export const PLAN_MODULE_KEYS = PLAN_MODULES.map((m) => m.key) as PlanModuleKey[];

/** Límites de uso. `null` = sin límite. */
export type PlanLimits = {
  workers: number | null;
  users: number | null;
  centers: number | null;
  storageMb: number | null;
};
export const UNLIMITED: PlanLimits = { workers: null, users: null, centers: null, storageMb: null };
