import { z } from "zod";
import { addDays, addMonths, daysInclusive } from "@/lib/dates";

export const CONCEPTS = [
  { value: "apto", label: "Apto" },
  { value: "apto_restricciones", label: "Apto con restricciones o recomendaciones" },
  { value: "aplazado", label: "Aplazado" },
  { value: "no_apto", label: "No apto (concepto del médico)" },
] as const;

export const CAUSES = [
  { value: "common_illness", label: "Enfermedad general (incapacidad)", medical: true },
  { value: "work_accident", label: "Accidente de trabajo", medical: true },
  { value: "occupational_disease", label: "Enfermedad laboral", medical: true },
  { value: "maternity", label: "Licencia de maternidad", medical: true },
  { value: "paternity", label: "Licencia de paternidad", medical: true },
  { value: "license", label: "Licencia (otra causa no médica)", medical: false },
  { value: "other", label: "Otra ausencia no médica", medical: false },
] as const;
export const isMedicalCause = (c: string) => CAUSES.find((x) => x.value === c)?.medical ?? false;

/**
 * Bloqueo explícito: no se permite registrar ni solicitar pruebas de embarazo, VIH o serología como requisito de ingreso o
 * permanencia (Resolución 1843 de 2025; Ley 1562 de 2012 y Ley 1098/Ley 361 — no discriminación). TODO-NORMA: confirmar el
 * listado con un experto SST.
 */
const BLOCKED =
  /embaraz|gestaci[oó]n|prueba\s+de\s+(hcg|gravidez)|\bvih\b|\bsida\b|serolog[ií]a|inmunodeficiencia/i;
export const blockedExamText = (text: string): boolean => BLOCKED.test(text.normalize("NFC"));
export function assertAllowedExamText(...texts: (string | null | undefined)[]) {
  if (texts.some((t) => t && blockedExamText(t)))
    throw new Error(
      "No se permite solicitar ni registrar pruebas de embarazo, VIH o serología como requisito: es discriminatorio.",
    );
}

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");
const opt = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const scheduleSchema = z.object({
  workerId: z.uuid(),
  type: z
    .string()
    .trim()
    .regex(/^[a-z_]+$/, "Tipo inválido"),
  scheduledDate: ymd,
  ipsName: opt(160),
  requestNote: opt(500),
});
export type ScheduleInput = z.input<typeof scheduleSchema>;

export const resultSchema = z
  .object({
    evaluationId: z.uuid(),
    performedDate: ymd,
    concept: z.enum(["apto", "apto_restricciones", "aplazado", "no_apto"]),
    restrictions: opt(),
    recommendations: opt(),
    ipsName: opt(160),
    costPesos: z
      .union([z.literal(""), z.coerce.number().int().min(0).max(1e10)])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
  })
  .superRefine((r, ctx) => {
    if (r.concept === "apto_restricciones" && !r.restrictions && !r.recommendations)
      ctx.addIssue({
        code: "custom",
        path: ["restrictions"],
        message: "Registra las restricciones o recomendaciones",
      });
  });
export type ResultInput = z.input<typeof resultSchema>;

export const absenceSchema = z
  .object({
    workerId: z.uuid(),
    cause: z.enum([
      "common_illness",
      "work_accident",
      "occupational_disease",
      "maternity",
      "paternity",
      "license",
      "other",
    ]),
    startDate: ymd,
    endDate: z
      .union([z.literal(""), ymd])
      .optional()
      .transform((v) => v || null),
    costPesos: z
      .union([z.literal(""), z.coerce.number().int().min(0).max(1e10)])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    note: opt(500),
  })
  .superRefine((a, ctx) => {
    if (a.endDate && a.endDate < a.startDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "El fin no puede ser anterior al inicio",
      });
  });
export type AbsenceInput = z.input<typeof absenceSchema>;

/** Plazo de la tarea de adaptación del puesto tras recibir recomendaciones o restricciones (20 días por defecto; parametrizable). */
export const adaptationDue = (performedDate: string, days: number) => addDays(performedDate, days);

/** Próxima evaluación periódica: desde la última periódica (o el ingreso) + la periodicidad parametrizada. TODO-NORMA: depende del profesiograma y los riesgos. */
export const nextPeriodicDue = (lastPeriodicOrStart: string, months: number) =>
  addMonths(lastPeriodicOrStart, months);

export type PeriodicState = "al_dia" | "por_vencer" | "vencida" | "sin_programar";
export function periodicState(due: string | null, today: string, warnDays: number): PeriodicState {
  if (!due) return "sin_programar";
  if (due < today) return "vencida";
  return Math.round((Date.parse(due) - Date.parse(today)) / 86_400_000) <= warnDays
    ? "por_vencer"
    : "al_dia";
}

/**
 * Ausencias por causa NO médica de más de `thresholdDays` días calendario que obligan a una evaluación de retorno laboral
 * (Resolución 1843 de 2025). Una ausencia sigue pendiente mientras no haya una evaluación de retorno realizada desde su inicio.
 * Para ausencias en curso se cuentan los días hasta hoy.
 */
export function returnEvaluationsNeeded(
  absences: {
    id: string;
    workerId: string;
    cause: string;
    startDate: string;
    endDate: string | null;
  }[],
  doneReturnEvals: { workerId: string; performedDate: string }[],
  thresholdDays: number,
  today: string,
) {
  return absences.filter((a) => {
    if (isMedicalCause(a.cause)) return false;
    if (daysInclusive(a.startDate, a.endDate ?? today) <= thresholdDays) return false;
    return !doneReturnEvals.some(
      (e) => e.workerId === a.workerId && e.performedDate >= a.startDate,
    );
  });
}

/** Tasa de ausentismo: días perdidos sobre días laborales programados (trabajadores × días del periodo). */
export function absenteeismRate(lostDays: number, workers: number, periodDays: number): number {
  const base = workers * periodDays;
  return base ? Math.round((lostDays / base) * 10000) / 100 : 0;
}

/** Días de una ausencia que caen dentro de [from, to] (recorta los extremos; en curso = hasta `to`). */
export function daysWithin(
  a: { startDate: string; endDate: string | null },
  from: string,
  to: string,
): number {
  const s = a.startDate > from ? a.startDate : from;
  const e = (a.endDate ?? to) < to ? (a.endDate ?? to) : to;
  return e < s ? 0 : daysInclusive(s, e);
}
