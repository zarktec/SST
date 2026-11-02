import { z } from "zod";

/**
 * Evaluación de desempeño 360 (formato F-RH-45 v01 de la empresa). No es un requisito del SG-SST: es un módulo de talento
 * humano. Competencias y descripciones de nivel tomadas del formato Excel «Evaluación de Desempeño 360».
 */

/** Niveles de quien evalúa (hojas del formato: Alta dirección, Jefe inmediato, Igual). */
export const LEVELS = [
  { value: "upper", label: "Alta dirección" },
  { value: "boss", label: "Jefe inmediato" },
  { value: "peer", label: "Igual" },
] as const;
export type Level = (typeof LEVELS)[number]["value"];
export const LEVEL_KEYS = LEVELS.map((l) => l.value) as [Level, ...Level[]];
export const levelLabel = (v: string) => LEVELS.find((l) => l.value === v)?.label ?? v;

export const SCALE_MIN = 1;
export const SCALE_MAX = 5;

export type Competency = {
  key: string;
  name: string;
  /** Descripción de cada calificación, de 5 (mejor) a 1. */
  levels: Record<"5" | "4" | "3" | "2" | "1", string>;
};

const c = (
  key: string,
  name: string,
  l5: string,
  l4: string,
  l3: string,
  l2: string,
  l1: string,
): Competency => ({ key, name, levels: { "5": l5, "4": l4, "3": l3, "2": l2, "1": l1 } });

/** Catálogo por defecto. Cada ciclo guarda una copia, así que cambiarlo no altera ciclos ya creados. */
export const DEFAULT_COMPETENCIES: Competency[] = [
  c(
    "comunicacion",
    "Comunicación",
    "Su forma de comunicarse es permanente, clara y objetiva, en ambos sentidos con todos.",
    "Se comunica permanentemente, de forma clara y objetiva, en ambos sentidos pero NO con todos.",
    "Se comunica cuando requiere, de forma clara y objetiva, aunque casi no escucha.",
    "Se comunica muy poco, de forma clara y objetiva, además no escucha.",
    "Comunicación prácticamente nula y es difícil de entender, además de no escuchar.",
  ),
  c(
    "liderazgo",
    "Liderazgo",
    "Ha logrado GRAN influencia en su equipo, la gente sabe a dónde va y cómo hacerlo. Tiene gran seguridad.",
    "Ha logrado cierta influencia en su equipo, la gente sabe a dónde va y cómo hacerlo. Tiene seguridad.",
    "Tiene el respeto de la mayoría, ha sabido trabajar en equipo sin problemas y sus compañeros sienten confianza.",
    "Poca gente le tiene confianza, no ha sabido trabajar en equipo con seguridad, hay dudas de lo que quiere.",
    "Nula confianza y seguridad hacia él por parte del equipo, graves deficiencias de trabajo en equipo.",
  ),
  c(
    "motivacion",
    "Motivación",
    "Su forma de ser y de comunicarse generan motivación en todo el equipo de trabajo.",
    "Ha sabido mantener elevada y constante la motivación de su equipo a pesar de las inconformidades del día a día.",
    "Hay motivación, aunque no es siempre.",
    "Poca motivación y de vez en cuando presenta pasividad y actitud negativa.",
    "Se le ve sumamente desmotivado hacia su trabajo.",
  ),
  c(
    "sst",
    "Seguridad y salud en el trabajo",
    "Cumple estrictamente el SG-SST, no ha tenido accidentes ni incidentes de trabajo ni llamados de atención.",
    "Cumple el SG-SST, sin embargo en seguridad puede mejorar. No ha tenido accidentes ni incidentes de trabajo ni llamados de atención.",
    "La inconsistencia en el cumplimiento del SG-SST ha provocado de vez en cuando problemas, accidentes y llamados de atención, aunque muy leves.",
    "Hay deficiencias notables en el cumplimiento del SG-SST, lo que ha llevado a que se den accidentes serios y llamados de atención.",
    "La falta de cumplimiento del SG-SST. Ha habido constantes y serios accidentes y llamados de atención.",
  ),
  c(
    "capacitacion",
    "Capacitación y desarrollo",
    "Excelente capacitación y adiestramiento en el campo, lo cual le permite anticiparse incluso a necesidades futuras.",
    "Buen nivel de capacitación y adiestramiento, aunque en ocasiones falta aplicarlo mejor y más frecuentemente.",
    "Hace falta un poco de capacitación y adiestramiento.",
    "Parece que muy poco le preocupa capacitarse y adiestrarse.",
    "Hay deficiencias serias en capacitación y adiestramiento.",
  ),
  c(
    "actitud",
    "Actitud y colaboración",
    "Se aprecia una actitud excepcional y permanente de colaboración y de servicio.",
    "Se ve buena actitud y colaboración todos los días.",
    "Hay buena colaboración y actitud de servicio, aunque no se ve diario así.",
    "En ocasiones se aprecia falta de colaboración.",
    "Deficiencias notables y permanentes en cuanto a colaboración y actitud de servicio.",
  ),
  c(
    "solucion_problemas",
    "Solución de problemas",
    "Encuentra soluciones efectivas y de forma oportuna a todas y diversas situaciones que se le presentan.",
    "Da soluciones adecuadas y a tiempo a las situaciones y problemas que se le presentan.",
    "Aporta soluciones adecuadas, aunque en ocasiones un poco lento a los problemas que se presentan.",
    "Ha tomado algunas decisiones equivocadas y a destiempo ante los problemas y situaciones que se presentan.",
    "La mayoría de sus decisiones dejan mucho que desear y generalmente cuando ya es tarde.",
  ),
  c(
    "ambiente",
    "Ambiente de trabajo",
    "Se aprecia un ambiente de trabajo extraordinario y esto es así permanentemente.",
    "Hay buen ambiente de trabajo y es constante, todo el mundo parece estar contento.",
    "La gente trabaja a gusto con él, dentro de un ambiente de trabajo tranquilo, seguro y confiable.",
    "Ha provocado, debido a diversas situaciones, mal ambiente de trabajo.",
    "El ambiente de trabajo generado es deplorable, se nota molestia y conflictos constantes.",
  ),
  c(
    "capacidad",
    "Capacidad personal",
    "Siempre ha demostrado conocimientos, habilidades y experiencia sorprendentes y excepcionales.",
    "Su capacidad, experiencia y habilidad personal nunca han dejado lugar a dudas. Es bueno en general.",
    "En alguna ocasión ha demostrado ciertas deficiencias en su capacidad, aunque no es muy notable.",
    "Ha habido varias ocasiones en que su falta de conocimientos, habilidad o experiencia le ha provocado problemas.",
    "Denota grandes deficiencias personales para llevar a cabo su trabajo.",
  ),
  c(
    "productividad",
    "Costos y productividad",
    "Demuestra actitud y resultados excepcionales en reducción de costos y productividad.",
    "Hay buena conciencia del costo y la productividad, además de hechos importantes que así lo demuestran.",
    "Falta ser más constante en su esfuerzo por mejorar la productividad y reducir costos.",
    "Deficiencias notorias en el aprovechamiento de los recursos, generando costos y baja productividad.",
    "Total falta de administración y aprovechamiento de recursos, provocando elevados costos y la más baja productividad.",
  ),
];

export type Ratings = Record<string, number>;

/** Promedio de una lista de números; `null` si está vacía. Redondea a 2 decimales. */
export const average = (xs: number[]): number | null =>
  xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null;

export type ResponseLike = { level: string; ratings: Ratings };

export type Tabulation = {
  /** Por competencia: promedio de cada nivel (null si ese nivel no ha respondido) y promedio general. */
  rows: { key: string; byLevel: Record<Level, number | null>; overall: number | null }[];
  /** Promedio general por nivel y total. */
  levelTotals: Record<Level, number | null>;
  overall: number | null;
  /** Cantidad de respuestas por nivel. */
  counts: Record<Level, number>;
};

/**
 * Tabulador 360: primero se promedian las respuestas de cada nivel (varios iguales cuentan como un solo nivel) y luego los
 * niveles que sí respondieron, con el mismo peso. TODO-NORMA: la hoja «TABULADOR 360» del formato no trae la fórmula de
 * ponderación entre niveles (las celdas vienen vacías); si la empresa define pesos distintos, parametrizarlos aquí.
 */
export function tabulate(competencyKeys: string[], responses: ResponseLike[]): Tabulation {
  const counts = { upper: 0, boss: 0, peer: 0 } as Record<Level, number>;
  for (const r of responses) if (r.level in counts) counts[r.level as Level]++;
  const levelAvg = (level: Level, key: string) =>
    average(
      responses
        .filter((r) => r.level === level && typeof r.ratings[key] === "number")
        .map((r) => r.ratings[key]),
    );
  const rows = competencyKeys.map((key) => {
    const byLevel = {
      upper: levelAvg("upper", key),
      boss: levelAvg("boss", key),
      peer: levelAvg("peer", key),
    } as Record<Level, number | null>;
    return {
      key,
      byLevel,
      overall: average(Object.values(byLevel).filter((v): v is number => v !== null)),
    };
  });
  const levelTotals = Object.fromEntries(
    LEVEL_KEYS.map((l) => [
      l,
      average(rows.map((r) => r.byLevel[l]).filter((v): v is number => v !== null)),
    ]),
  ) as Record<Level, number | null>;
  const overall = average(rows.map((r) => r.overall).filter((v): v is number => v !== null));
  return { rows, levelTotals, overall, counts };
}

/** Las calificaciones enviadas deben cubrir todas las competencias del ciclo con enteros de 1 a 5. */
export function validateRatings(
  competencyKeys: string[],
  raw: Record<string, unknown>,
): { ok: true; ratings: Ratings } | { ok: false; missing: string[] } {
  const ratings: Ratings = {};
  const missing: string[] = [];
  for (const k of competencyKeys) {
    const n = Number(raw[k]);
    if (Number.isInteger(n) && n >= SCALE_MIN && n <= SCALE_MAX) ratings[k] = n;
    else missing.push(k);
  }
  return missing.length ? { ok: false, missing } : { ok: true, ratings };
}

/** Un evaluador no puede evaluarse a sí mismo. */
export const isSelfEvaluation = (subjectWorkerId: string, evaluatorWorkerId: string) =>
  subjectWorkerId === evaluatorWorkerId;

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");
export const cycleSchema = z.object({
  name: z.string().trim().min(4, "Indica el nombre del ciclo").max(120),
  dueOn: ymd,
});
export const subjectSchema = z.object({
  cycleId: z.string().uuid(),
  workerId: z.string().uuid("Elige la persona a evaluar"),
});
export const assignmentSchema = z.object({
  subjectId: z.string().uuid(),
  level: z.enum(LEVEL_KEYS),
  evaluatorWorkerId: z.string().uuid("Elige quién evalúa"),
});
export const commentSchema = z
  .string()
  .trim()
  .max(1500, "El comentario es muy largo")
  .optional()
  .transform((v) => v || null);
