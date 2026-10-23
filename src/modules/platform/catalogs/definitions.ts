import { z } from "zod";

/**
 * Definición de cada catálogo normativo: esquema del dato, cómo se calcula el código del elemento y
 * qué columnas mostrar. Agregar un catálogo nuevo = agregar una entrada aquí (sin migración).
 * Toda cifra o plazo normativo lleva `sourceNorm`; mientras no la valide un experto SST va con `todoNorma`.
 */
const norm = z.string().trim().max(300).default("");
const todo = z.boolean().default(true);

export const CATALOGS = {
  parameters: {
    label: "Parámetros normativos",
    description:
      "Plazos, periodicidades y umbrales (días hábiles de reporte, vigencias, etc.) con su norma fuente.",
    schema: z.object({
      key: z
        .string()
        .trim()
        .regex(/^[a-z0-9_.]+$/, "Solo minúsculas, números, punto y guion bajo"),
      value: z.union([z.number(), z.string(), z.boolean()]),
      unit: z.string().trim().max(40).default(""),
      description: z.string().trim().min(3).max(300),
      sourceNorm: norm,
      todoNorma: todo,
    }),
    code: (d: { key: string }) => d.key,
    columns: ["key", "value", "unit", "sourceNorm"],
  },
  rating_ranges: {
    label: "Rangos de calificación (Res. 0312)",
    description:
      "Rangos de la autoevaluación (crítico, moderadamente aceptable, aceptable) y sus acciones.",
    schema: z.object({
      level: z.enum(["critico", "moderado", "aceptable"]),
      label: z.string().trim().min(2),
      minPct: z.number().min(0).max(100).nullable(),
      maxPct: z.number().min(0).max(100).nullable(),
      minInclusive: z.boolean().default(true),
      maxInclusive: z.boolean().default(false),
      actions: z.array(z.string().trim().min(2)).default([]),
      sourceNorm: norm,
      todoNorma: todo,
    }),
    code: (d: { level: string }) => d.level,
    columns: ["level", "label", "minPct", "maxPct"],
  },
  size_risk_groups: {
    label: "Grupos de estándares por tamaño y riesgo",
    description:
      "Reglas que determinan si aplican 7, 21 o 60 estándares (se evalúan por prioridad).",
    schema: z.object({
      group: z.union([z.literal(7), z.literal(21), z.literal(60)]),
      priority: z.number().int().min(1),
      minWorkers: z.number().int().min(0).nullable(),
      maxWorkers: z.number().int().min(0).nullable(),
      riskClasses: z.array(z.number().int().min(1).max(5)).min(1),
      sourceNorm: norm,
      todoNorma: todo,
    }),
    code: (d: { group: number; priority: number }) => `g${d.group}-p${d.priority}`,
    columns: ["group", "priority", "minWorkers", "maxWorkers", "riskClasses"],
  },
  standards_0312: {
    label: "Estándares mínimos (Res. 0312)",
    description: "Ciclo PHVA, estándar, ítem, criterio, modo de verificación y valor.",
    schema: z.object({
      phva: z.enum(["P", "H", "V", "A"]),
      standardCode: z.string().trim().min(1),
      standardName: z.string().trim().min(2),
      itemCode: z.string().trim().min(1),
      criterion: z.string().trim().min(3),
      verification: z.string().trim().default(""),
      weight: z.number().min(0),
      appliesToGroups: z.array(z.union([z.literal(7), z.literal(21), z.literal(60)])).min(1),
      sourceNorm: norm,
    }),
    code: (d: { itemCode: string }) => d.itemCode,
    columns: ["phva", "itemCode", "criterion", "weight", "appliesToGroups"],
  },
  economic_activities: {
    label: "Actividades económicas y clase de riesgo",
    description: "CIIU y clase de riesgo (Decreto 768 de 2022).",
    schema: z.object({
      ciiu: z
        .string()
        .trim()
        .regex(/^\d{4}$/, "CIIU de 4 dígitos"),
      name: z.string().trim().min(2),
      riskClass: z.number().int().min(1).max(5),
      sourceNorm: norm,
    }),
    code: (d: { ciiu: string }) => d.ciiu,
    columns: ["ciiu", "name", "riskClass"],
  },
  hazard_catalog: {
    label: "Catálogo de peligros",
    description: "Familias y peligros para la matriz GTC 45.",
    schema: z.object({
      family: z.string().trim().min(2),
      hazard: z.string().trim().min(2),
      description: z.string().trim().default(""),
    }),
    code: (d: { family: string; hazard: string }) =>
      `${d.family}:${d.hazard}`.toLowerCase().replace(/\s+/g, "_"),
    columns: ["family", "hazard"],
  },
  gtc45_scales: {
    label: "Escalas de valoración (GTC 45)",
    description:
      "Niveles de deficiencia, exposición, probabilidad, consecuencia, riesgo y aceptabilidad.",
    schema: z.object({
      dimension: z.enum([
        "deficiency",
        "exposure",
        "probability",
        "consequence",
        "risk",
        "acceptability",
      ]),
      level: z.string().trim().min(1),
      value: z.number().nullable(),
      min: z.number().nullable().default(null),
      max: z.number().nullable().default(null),
      meaning: z.string().trim().min(2),
      sourceNorm: norm,
      todoNorma: todo,
    }),
    code: (d: { dimension: string; level: string }) => `${d.dimension}:${d.level}`,
    columns: ["dimension", "level", "value", "min", "max"],
  },
  legal_norms: {
    label: "Matriz legal base: normas",
    description: "Normas que alimentan la matriz legal de las empresas.",
    schema: z.object({
      type: z.enum(["Ley", "Decreto", "Resolución", "Circular", "Otra"]),
      number: z.string().trim().min(1),
      year: z.number().int().min(1900).max(2100),
      title: z.string().trim().min(3),
      issuer: z.string().trim().default(""),
      appliesTo: z.array(z.string().trim()).default([]),
      url: z.string().trim().default(""),
      todoNorma: todo,
    }),
    code: (d: { type: string; number: string; year: number }) =>
      `${d.type}-${d.number}-${d.year}`.toLowerCase(),
    columns: ["type", "number", "year", "title"],
  },
  legal_requirements: {
    label: "Matriz legal base: requisitos",
    description: "Artículos y requisitos por norma, y a quién aplican.",
    schema: z.object({
      normCode: z.string().trim().min(3),
      article: z.string().trim().min(1),
      requirement: z.string().trim().min(3),
      appliesTo: z.array(z.string().trim()).default([]),
      periodicity: z.string().trim().default(""),
    }),
    code: (d: { normCode: string; article: string }) => `${d.normCode}#${d.article}`,
    columns: ["normCode", "article", "requirement"],
  },
  indicators: {
    label: "Indicadores",
    description: "Fórmulas parametrizables (Decreto 1072 y art. 30 de la Res. 0312).",
    schema: z.object({
      code: z
        .string()
        .trim()
        .regex(/^[a-z0-9_]+$/),
      name: z.string().trim().min(2),
      type: z.enum(["estructura", "proceso", "resultado"]),
      numerator: z.string().trim().min(2),
      denominator: z.string().trim().min(2),
      factor: z.number().positive(),
      periodicity: z.enum(["mensual", "trimestral", "semestral", "anual"]),
      target: z.number().nullable().default(null),
      sourceNorm: norm,
      todoNorma: todo,
    }),
    code: (d: { code: string }) => d.code,
    columns: ["code", "name", "periodicity", "factor"],
  },
  medical_eval_types: {
    label: "Tipos de evaluación médica (Res. 1843)",
    description: "Preingreso, periódica, egreso, postincapacidad, retorno laboral y seguimiento.",
    schema: z.object({
      code: z
        .string()
        .trim()
        .regex(/^[a-z_]+$/),
      name: z.string().trim().min(2),
      description: z.string().trim().default(""),
      sourceNorm: norm,
      todoNorma: todo,
    }),
    code: (d: { code: string }) => d.code,
    columns: ["code", "name"],
  },
  doc_templates: {
    label: "Plantillas de documentos",
    description:
      "Texto con variables como {{empresa.razonSocial}}: política, objetivos, actas, procedimientos, informes.",
    schema: z.object({
      code: z
        .string()
        .trim()
        .regex(/^[a-z0-9_.-]+$/),
      kind: z.string().trim().min(2),
      name: z.string().trim().min(2),
      body: z.string().min(1),
      variables: z.array(z.string()).default([]),
    }),
    code: (d: { code: string }) => d.code,
    columns: ["code", "kind", "name"],
  },
  checklist_templates: {
    label: "Plantillas de checklists de inspección",
    description: "Listas de verificación configurables.",
    schema: z.object({
      code: z
        .string()
        .trim()
        .regex(/^[a-z0-9_.-]+$/),
      name: z.string().trim().min(2),
      category: z.string().trim().min(2),
      items: z
        .array(
          z.object({
            id: z.string().min(1),
            text: z.string().min(2),
            required: z.boolean().default(false),
          }),
        )
        .min(1),
    }),
    code: (d: { code: string }) => d.code,
    columns: ["code", "name", "category"],
  },
  export_templates: {
    label: "Plantillas de exportación regulatoria",
    description: "Formatos para entes reguladores; editables cuando cambie el formato oficial.",
    schema: z.object({
      code: z
        .string()
        .trim()
        .regex(/^[a-z0-9_.-]+$/),
      kind: z.string().trim().min(2),
      format: z.enum(["pdf", "xlsx", "csv"]),
      layout: z.record(z.string(), z.unknown()).default({}),
      sourceNorm: norm,
    }),
    code: (d: { code: string; format: string }) => `${d.code}.${d.format}`,
    columns: ["code", "kind", "format"],
  },
  obligations: {
    label: "Calendario de obligaciones",
    description: "Fechas y plazos de obligaciones (autoevaluación, reportes anuales, etc.).",
    schema: z.object({
      code: z
        .string()
        .trim()
        .regex(/^[a-z0-9_.-]+$/),
      name: z.string().trim().min(2),
      rule: z.object({
        type: z.enum(["annual_month", "fixed_date", "relative"]),
        month: z.number().int().min(1).max(12).optional(),
        day: z.number().int().min(1).max(31).optional(),
        date: z.string().optional(),
        offsetDays: z.number().int().optional(),
      }),
      notifyDaysBefore: z.array(z.number().int().min(0)).default([30, 7, 1]),
      sourceNorm: norm,
      todoNorma: todo,
    }),
    code: (d: { code: string }) => d.code,
    columns: ["code", "name", "rule"],
  },
} as const;

export type CatalogKey = keyof typeof CATALOGS;
export const CATALOG_KEYS = Object.keys(CATALOGS) as CatalogKey[];

export function isCatalogKey(k: string): k is CatalogKey {
  return k in CATALOGS;
}

/** Valida un elemento contra el esquema del catálogo y calcula su código. Lanza con mensajes legibles. */
export function parseItem(
  catalog: CatalogKey,
  raw: unknown,
): { code: string; data: Record<string, unknown> } {
  const def = CATALOGS[catalog];
  const res = def.schema.safeParse(raw);
  if (!res.success) {
    const issue = res.error.issues[0];
    throw new Error(`${issue.path.join(".") || "elemento"}: ${issue.message}`);
  }
  const data = res.data as Record<string, unknown>;
  return { code: (def.code as (d: never) => string)(data as never), data };
}
