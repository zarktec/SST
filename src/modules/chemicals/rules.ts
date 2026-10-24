import { z } from "zod";
import { addMonths } from "@/lib/dates";

/** Pictogramas del Sistema Globalmente Armonizado (SGA/GHS). */
export const PICTOGRAMS = [
  { value: "GHS01", label: "Explosivo" },
  { value: "GHS02", label: "Inflamable" },
  { value: "GHS03", label: "Comburente" },
  { value: "GHS04", label: "Gas a presión" },
  { value: "GHS05", label: "Corrosivo" },
  { value: "GHS06", label: "Toxicidad aguda" },
  { value: "GHS07", label: "Irritante / nocivo" },
  { value: "GHS08", label: "Peligro para la salud" },
  { value: "GHS09", label: "Peligro para el medio ambiente" },
] as const;
export const SIGNAL_WORDS = [
  { value: "none", label: "Sin palabra de advertencia" },
  { value: "warning", label: "Atención" },
  { value: "danger", label: "Peligro" },
] as const;

/**
 * Pares de pictogramas que no deben almacenarse juntos. Matriz PROVISIONAL (TODO-NORMA): criterio general de segregación
 * (explosivos, inflamables, comburentes y corrosivos); validar con el experto y con las FDS (sección 7) de cada producto.
 */
export const INCOMPATIBLE: [string, string][] = [
  ["GHS01", "GHS02"],
  ["GHS01", "GHS03"],
  ["GHS02", "GHS03"],
  ["GHS02", "GHS05"],
];

export type Conflict = { location: string; a: string; b: string; reason: string };
const norm = (s: string) => s.trim().toLowerCase();
/** Incompatibilidades entre sustancias activas almacenadas en el mismo lugar. */
export function compatibilityConflicts(
  subs: { id: string; name: string; location: string; pictograms: string[] }[],
): Conflict[] {
  const out: Conflict[] = [];
  const label = (g: string) => PICTOGRAMS.find((p) => p.value === g)?.label ?? g;
  for (let i = 0; i < subs.length; i++)
    for (let j = i + 1; j < subs.length; j++) {
      const [x, y] = [subs[i], subs[j]];
      if (norm(x.location) !== norm(y.location)) continue;
      const hit = INCOMPATIBLE.find(
        ([p, q]) =>
          (x.pictograms.includes(p) && y.pictograms.includes(q)) ||
          (x.pictograms.includes(q) && y.pictograms.includes(p)),
      );
      if (hit) {
        const [p, q] = hit;
        out.push({
          location: x.location,
          a: x.name,
          b: y.name,
          reason: `${label(p)} con ${label(q)}`,
        });
      }
    }
  return out;
}

export type SdsState = "sin_fds" | "vigente" | "por_revisar";
/** La FDS debe revisarse cada `years` años (TODO-NORMA, parametrizable `quimicos.revision_fds_anios`). */
export function sdsState(revisedOn: string | null, today: string, years: number): SdsState {
  if (!revisedOn) return "sin_fds";
  return addMonths(revisedOn, years * 12) < today ? "por_revisar" : "vigente";
}

export function substanceIssues(
  s: {
    pictograms: string[];
    signalWord: string;
    sdsRevisedOn: string | null;
    labelCheckedOn: string | null;
  },
  today: string,
  sdsYears: number,
): string[] {
  const e: string[] = [];
  const sds = sdsState(s.sdsRevisedOn, today, sdsYears);
  if (sds === "sin_fds") e.push("Sin ficha de datos de seguridad (FDS)");
  if (sds === "por_revisar") e.push("FDS por revisar");
  if (!s.labelCheckedOn) e.push("Etiquetado sin verificar");
  if (!s.pictograms.length && s.signalWord === "none") e.push("Sin clasificación SGA");
  return e;
}

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");
const optDate = z
  .union([z.literal(""), ymd])
  .optional()
  .transform((v) => v || null);
const optText = (max = 300) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
export const substanceSchema = z.object({
  name: z.string().trim().min(2, "Indica el nombre").max(150),
  casNumber: z
    .union([
      z.literal(""),
      z
        .string()
        .trim()
        .regex(/^\d{2,7}-\d{2}-\d$/, "CAS inválido (ej. 67-64-1)"),
    ])
    .optional()
    .transform((v) => v || null),
  supplier: optText(150),
  location: z.string().trim().min(2, "Indica dónde se almacena").max(150),
  workCenterId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => v || null),
  quantity: optText(60),
  signalWord: z.enum(["none", "warning", "danger"]).default("none"),
  hStatements: optText(1000),
  sdsRevisedOn: optDate,
  labelCheckedOn: optDate,
  pictograms: z
    .array(
      z.enum(["GHS01", "GHS02", "GHS03", "GHS04", "GHS05", "GHS06", "GHS07", "GHS08", "GHS09"]),
    )
    .default([]),
});
export type SubstanceInput = z.input<typeof substanceSchema>;
