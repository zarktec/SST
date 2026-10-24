import { z } from "zod";
import { addDays, addMonths, daysBetween } from "@/lib/dates";

export const ASSET_KINDS = [
  { value: "extinguisher", label: "Extintor" },
  { value: "first_aid_kit", label: "Botiquín" },
  { value: "stretcher", label: "Camilla" },
  { value: "other", label: "Otro equipo" },
] as const;
export const BRIGADE_ROLES = [
  { value: "chief", label: "Jefe de brigada" },
  { value: "first_aid", label: "Primeros auxilios" },
  { value: "evacuation", label: "Evacuación" },
  { value: "fire", label: "Contra incendios" },
] as const;
export const VULNERABILITY = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
] as const;

export type ExpiryState = "vigente" | "por_vencer" | "vencido" | "sin_fecha";
/** Estado de la vigencia (recarga, contenido del botiquín). Anticipación parametrizable (`emergencias.alerta_vencimiento_dias`). */
export function expiryState(
  expiresOn: string | null,
  today: string,
  warnDays: number,
): ExpiryState {
  if (!expiresOn) return "sin_fecha";
  if (expiresOn < today) return "vencido";
  return daysBetween(today, expiresOn) <= warnDays ? "por_vencer" : "vigente";
}

export type InspectionState = "al_dia" | "vencida" | "sin_inspeccion";
/** Inspección periódica de equipos: cada `everyDays` días (Decreto 1072, art. 2.2.4.6.25; periodicidad TODO-NORMA, parametrizable). */
export function inspectionState(
  last: string | null,
  today: string,
  everyDays: number,
): InspectionState {
  if (!last) return "sin_inspeccion";
  return addDays(last, everyDays) < today ? "vencida" : "al_dia";
}

export type DrillStatus = { done: number; planned: number; required: number; ok: boolean };
/** Simulacros del año: mínimo `required` realizados (spec §6.3; parametrizable `emergencias.simulacros_minimos_anio`). */
export function drillStatus(
  drills: { status: string; plannedOn: string; performedOn: string | null }[],
  year: number,
  required: number,
): DrillStatus {
  const y = String(year);
  const done = drills.filter(
    (d) => d.status === "done" && (d.performedOn ?? d.plannedOn).startsWith(y),
  ).length;
  const planned = drills.filter((d) => d.status === "planned" && d.plannedOn.startsWith(y)).length;
  return { done, planned, required, ok: done >= required };
}

export const nextPlanReview = (reviewedOn: string, months: number) => addMonths(reviewedOn, months);

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");
const optDate = z
  .union([z.literal(""), ymd])
  .optional()
  .transform((v) => v || null);
const optText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
const optId = z
  .union([z.uuid(), z.literal("")])
  .optional()
  .transform((v) => v || null);
const optInt = z
  .union([z.literal(""), z.coerce.number().int().min(0).max(100000)])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const assetSchema = z.object({
  kind: z.enum(["extinguisher", "first_aid_kit", "stretcher", "other"]),
  code: z.string().trim().min(1, "Indica el código o rótulo").max(60),
  location: z.string().trim().min(2, "Indica la ubicación").max(200),
  workCenterId: optId,
  detail: optText(300),
  expiresOn: optDate,
});
export const assetInspectionSchema = z.object({
  performedOn: ymd,
  ok: z.union([z.boolean(), z.string()]).transform((v) => v === true || v === "true" || v === "on"),
  note: optText(500),
});
export const brigadeSchema = z.object({
  workerId: z.uuid("Selecciona la persona"),
  role: z.enum(["chief", "first_aid", "evacuation", "fire"]),
  joinedOn: ymd,
  lastTrainingOn: optDate,
  dotation: optText(300),
});
export const planSchema = z.object({
  workCenterId: optId,
  vulnerability: z.enum(["low", "medium", "high"]),
  vulnerabilityAnalysis: z
    .string()
    .trim()
    .min(10, "Describe el análisis de vulnerabilidad")
    .max(5000),
  pon: optText(5000),
  evacuationRoutes: optText(3000),
  reviewedOn: ymd,
});
export const drillSchema = z.object({
  workCenterId: optId,
  scenario: z.string().trim().min(5, "Describe el escenario del simulacro").max(300),
  plannedOn: ymd,
});
export const drillResultSchema = z.object({
  performedOn: ymd,
  participants: optInt,
  evacuationMinutes: optInt,
  evaluation: z.string().trim().min(10, "Escribe la evaluación del simulacro").max(3000),
  /** Una mejora por línea: cada una se vuelve una acción en el módulo CAPA. */
  improvements: z
    .string()
    .optional()
    .transform((t) =>
      (t ?? "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length >= 5),
    ),
  responsibleName: optText(120),
});
