import { z } from "zod";

export type Scale = {
  dimension: string;
  level: string;
  value: number | null;
  min: number | null;
  max: number | null;
  meaning: string;
};

export type Valuation =
  | { valued: false; reason: string }
  | {
      valued: true;
      np: number;
      nr: number;
      probabilityLevel: string;
      riskLevel: string;
      acceptability: string;
    };

/** Nivel cuyo rango contiene `v`; si cae en un vacío entre rangos, el de mayor mínimo que no lo supere (los productos ND×NE y NP×NC son discretos). */
function levelByRange(scales: Scale[], dimension: string, v: number): string | null {
  const ranges = scales
    .filter((s) => s.dimension === dimension && s.min !== null && s.max !== null)
    .sort((a, b) => (b.min as number) - (a.min as number));
  const hit = ranges.find((s) => v >= (s.min as number));
  if (!hit) return ranges.length ? ranges[ranges.length - 1].level : null;
  return hit.level;
}

/**
 * Valoración GTC 45: NP = ND × NE; NR = NP × NC. El nivel de probabilidad, el de riesgo y su aceptabilidad salen de las
 * escalas del catálogo `gtc45_scales` (datos, no código). Una deficiencia sin valor numérico (p. ej. "Bajo") no se valora.
 * TODO-NORMA: validar las escalas con un experto SST.
 */
export function valuate(
  input: { deficiency: string; exposure: string; consequence: string },
  scales: Scale[],
): Valuation {
  const find = (dimension: string, level: string) =>
    scales.find((s) => s.dimension === dimension && s.level === level);
  const nd = find("deficiency", input.deficiency);
  const ne = find("exposure", input.exposure);
  const nc = find("consequence", input.consequence);
  if (!nd) return { valued: false, reason: "Nivel de deficiencia desconocido" };
  if (!ne) return { valued: false, reason: "Nivel de exposición desconocido" };
  if (!nc) return { valued: false, reason: "Nivel de consecuencia desconocido" };
  if (nd.value === null)
    return { valued: false, reason: "Deficiencia sin valor numérico: el riesgo no se valora" };
  if (ne.value === null || nc.value === null)
    return { valued: false, reason: "La escala no define el valor" };
  const np = nd.value * ne.value;
  const nr = np * nc.value;
  const probabilityLevel = levelByRange(scales, "probability", np);
  const riskLevel = levelByRange(scales, "risk", nr);
  if (!probabilityLevel || !riskLevel)
    return { valued: false, reason: "Las escalas de probabilidad o riesgo están incompletas" };
  const acceptability = find("acceptability", riskLevel)?.meaning ?? "";
  return { valued: true, np, nr, probabilityLevel, riskLevel, acceptability };
}

/** Orden de prioridad: mayor NR primero; los no valorados al final. */
export const byPriority = <T extends { nr: number | null }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => (b.nr ?? -1) - (a.nr ?? -1));

export type Controls = {
  ctrlElimination?: string | null;
  ctrlSubstitution?: string | null;
  ctrlEngineering?: string | null;
  ctrlAdmin?: string | null;
  ctrlEpp?: string | null;
};

/**
 * Advertencias de la jerarquía de controles (Decreto 1072 de 2015, art. 2.2.4.6.24): un riesgo no aceptable sin controles
 * propuestos, o resuelto solo con EPP/administrativos cuando se pudo actuar en la fuente o el medio.
 */
export function controlWarnings(v: Valuation, c: Controls): string[] {
  if (!v.valued) return [];
  const w: string[] = [];
  const has = (x?: string | null) => Boolean(x?.trim());
  const any =
    has(c.ctrlElimination) ||
    has(c.ctrlSubstitution) ||
    has(c.ctrlEngineering) ||
    has(c.ctrlAdmin) ||
    has(c.ctrlEpp);
  const unacceptable = v.riskLevel === "I" || v.riskLevel === "II";
  if (unacceptable && !any) w.push("Riesgo no aceptable sin controles propuestos");
  if (
    unacceptable &&
    any &&
    !has(c.ctrlElimination) &&
    !has(c.ctrlSubstitution) &&
    !has(c.ctrlEngineering)
  )
    w.push(
      "Considera eliminación, sustitución o controles de ingeniería antes de controles administrativos o EPP",
    );
  return w;
}

const t = (min = 1, max = 300) => z.string().trim().min(min).max(max);
const o = (max = 600) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const hazardRowSchema = z.object({
  process: t(2, 120),
  activity: t(2, 160),
  task: t(2, 160),
  routine: z
    .union([z.boolean(), z.enum(["yes", "no", "on"])])
    .transform((v) => v === true || v === "yes" || v === "on"),
  workCenterId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => v || null),
  hazardFamily: t(2, 120),
  hazardName: t(2, 160),
  description: o(),
  effects: o(),
  existingSource: o(),
  existingMedium: o(),
  existingPerson: o(),
  exposedWorkers: z.coerce.number().int().min(0).max(1_000_000).default(0),
  deficiency: t(),
  exposure: t(),
  consequence: t(),
  ctrlElimination: o(),
  ctrlSubstitution: o(),
  ctrlEngineering: o(),
  ctrlAdmin: o(),
  ctrlEpp: o(),
  legalRequirement: o(),
});
export type HazardRowInput = z.input<typeof hazardRowSchema>;

/** ¿Toca revisar la matriz? Mínimo anual (parametrizable) desde la aprobación de la versión vigente. */
export function reviewDue(approvedAt: Date | null, now: Date, months: number): boolean {
  if (!approvedAt) return true;
  const due = new Date(
    Date.UTC(
      approvedAt.getUTCFullYear(),
      approvedAt.getUTCMonth() + months,
      approvedAt.getUTCDate(),
    ),
  );
  return now >= due;
}
