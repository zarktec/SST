import { z } from "zod";
import { addMonths } from "@/lib/dates";

export const PVE_TYPES = [
  { value: "musculoskeletal", label: "Osteomuscular" },
  { value: "auditory", label: "Auditivo" },
  { value: "cardiovascular", label: "Cardiovascular" },
  { value: "visual", label: "Visual" },
  { value: "psychosocial", label: "Psicosocial" },
] as const;
export const RISK_LEVELS = [
  { value: "low", label: "Bajo" },
  { value: "medium", label: "Medio" },
  { value: "high", label: "Alto" },
] as const;
/** Niveles de riesgo psicosocial de la batería (Resolución 2646 de 2008). */
export const PSY_LEVELS = [
  { value: "none", label: "Sin riesgo o riesgo despreciable" },
  { value: "low", label: "Riesgo bajo" },
  { value: "medium", label: "Riesgo medio" },
  { value: "high", label: "Riesgo alto" },
  { value: "very_high", label: "Riesgo muy alto" },
] as const;

/**
 * Próxima aplicación de la batería: anual si el riesgo es alto o muy alto, cada 2 años si es medio, bajo o nulo
 * (Resolución 2646 de 2008, art. 13; periodos parametrizables `psicosocial.periodicidad_*`, TODO-NORMA para el nivel "muy alto").
 */
export function psychosocialNextDue(
  appliedOn: string,
  level: string,
  months: { high: number; mediumLow: number },
): string {
  const high = level === "high" || level === "very_high";
  return addMonths(appliedOn, high ? months.high : months.mediumLow);
}

export type DueState = "al_dia" | "por_vencer" | "vencida" | "sin_aplicar";
export function psychosocialState(
  nextDueOn: string | null,
  today: string,
  warnDays: number,
): DueState {
  if (!nextDueOn) return "sin_aplicar";
  if (nextDueOn < today) return "vencida";
  const days = Math.round((Date.parse(nextDueOn) - Date.parse(today)) / 86_400_000);
  return days <= warnDays ? "por_vencer" : "al_dia";
}

export type FollowUpState = "al_dia" | "vencido" | "sin_fecha";
export const followUpState = (next: string | null, today: string): FollowUpState =>
  !next ? "sin_fecha" : next < today ? "vencido" : "al_dia";

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
const optInt = z
  .union([z.literal(""), z.coerce.number().int().min(0).max(100000)])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const programSchema = z.object({
  type: z.enum(["musculoskeletal", "auditory", "cardiovascular", "visual", "psychosocial"]),
  name: z.string().trim().min(3, "Indica el nombre").max(150),
  objective: optText(1000),
  population: optText(1000),
  startedOn: ymd,
});
export const activitySchema = z.object({
  programId: z.uuid(),
  description: z.string().trim().min(5, "Describe la actividad").max(500),
  plannedOn: ymd,
});
export const activityDoneSchema = z.object({
  performedOn: ymd,
  participants: optInt,
});
export const caseSchema = z.object({
  programId: z.uuid("Selecciona el programa"),
  workerId: z.uuid("Selecciona la persona"),
  openedOn: ymd,
  riskLevel: z.enum(["low", "medium", "high"]),
  nextFollowUpOn: optDate,
  notes: optText(1500),
});
export const followupSchema = z.object({
  performedOn: ymd,
  note: z.string().trim().min(5, "Escribe el seguimiento").max(1500),
  nextFollowUpOn: optDate,
});
export const psychosocialSchema = z.object({
  appliedOn: ymd,
  psychologistName: z.string().trim().min(3, "Indica el psicólogo").max(120),
  licenseNumber: z
    .string()
    .trim()
    .min(3, "Indica la licencia en seguridad y salud en el trabajo")
    .max(60),
  riskLevel: z.enum(["none", "low", "medium", "high", "very_high"]),
  scope: optText(500),
  notes: optText(1500),
  /** Plan de intervención: una acción por línea, cada una crea una acción en el módulo CAPA. */
  interventions: z
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
