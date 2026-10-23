import { z } from "zod";
import {
  addBusinessDays,
  businessDaysBetween,
  bogotaDate,
  type BusinessCalendar,
} from "@/core/calendar/business-days";
import { addDays } from "@/lib/dates";
import type { TeamMember } from "@/core/db/schema/incidents";

export const SEVERITY = [
  { value: "none", label: "Sin lesión (incidente)" },
  { value: "minor", label: "Leve" },
  { value: "serious", label: "Grave" },
  { value: "fatal", label: "Mortal" },
] as const;
export const isSevere = (s: string) => s === "serious" || s === "fatal";

/**
 * Plazo para reportar a la ARL y a la EPS: 2 días hábiles desde que la empresa conoce el evento (Resolución 156 de 2005, art. 3;
 * Decreto 1295 de 1994, art. 62). Se cuenta con el calendario de festivos de Colombia. El plazo es parametrizable (TODO-NORMA).
 */
export function reportDeadline(knownAt: Date, businessDays: number, cal: BusinessCalendar): string {
  return addBusinessDays(bogotaDate(knownAt), businessDays, cal);
}

export type ReportState = {
  state: "reportado" | "en_plazo" | "vence_hoy" | "vencido";
  businessDaysLeft: number;
};
/** Contador del plazo de reporte (días hábiles que quedan; negativo si ya se venció). */
export function reportState(
  deadline: string,
  reportedAt: string | null,
  today: string,
  cal: BusinessCalendar,
): ReportState {
  if (reportedAt) return { state: "reportado", businessDaysLeft: 0 };
  const left = businessDaysBetween(today, deadline, cal);
  return {
    state: left < 0 ? "vencido" : left === 0 ? "vence_hoy" : "en_plazo",
    businessDaysLeft: left,
  };
}

/** Investigación: 15 días siguientes al evento (Resolución 1401 de 2007, art. 7). Parametrizable (`at.investigacion_dias`). */
export const investigationDeadline = (occurredOn: string, days: number) =>
  addDays(occurredOn, days);

/**
 * Equipo investigador: jefe inmediato, representante del COPASST/Vigía y encargado del SG-SST; si el evento es grave o mortal,
 * además un profesional con licencia en SST (Resolución 1401 de 2007, art. 7). TODO-NORMA: validar la composición.
 */
export function teamErrors(team: TeamMember[], severe: boolean): string[] {
  const e: string[] = [];
  const has = (r: TeamMember["role"]) => team.some((m) => m.role === r && m.name.trim());
  if (!has("copasst")) e.push("Falta el representante del COPASST o Vigía SST");
  if (!has("sst")) e.push("Falta el responsable del SG-SST");
  if (!has("boss")) e.push("Falta el jefe inmediato o supervisor");
  if (severe && !has("licensed"))
    e.push("Por la gravedad, el equipo debe incluir un profesional con licencia en SST");
  return e;
}

export function analysisErrors(method: string, analysis: unknown): string[] {
  if (method === "five_whys") {
    const w = Array.isArray(analysis)
      ? (analysis as unknown[]).map((x) => String(x).trim()).filter(Boolean)
      : [];
    return w.length >= 3 ? [] : ["Los 5 porqués requieren al menos 3 niveles respondidos"];
  }
  const n = Array.isArray(analysis)
    ? (analysis as { text?: string }[]).filter((x) => x?.text?.trim())
    : [];
  return n.length >= 3 ? [] : ["El árbol de causas requiere al menos 3 nodos"];
}

/** Parsea el texto de los porqués (uno por línea). */
export const parseWhys = (t: string) =>
  t
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*\d+[.)-]\s*/, "").trim())
    .filter(Boolean);

export type CloseCheck = {
  team: TeamMember[];
  method: string;
  analysis: unknown;
  immediateCauses: string | null;
  basicCauses: string | null;
  actionCount: number;
  severe: boolean;
  remittedArlAt: string | null;
};
/** Requisitos para cerrar la investigación. */
export function closeBlockers(c: CloseCheck): string[] {
  const e = [...teamErrors(c.team, c.severe), ...analysisErrors(c.method, c.analysis)];
  if (!c.immediateCauses?.trim()) e.push("Registra las causas inmediatas");
  if (!c.basicCauses?.trim()) e.push("Registra las causas básicas");
  if (c.actionCount < 1) e.push("Crea al menos una acción del plan de acción");
  if (c.severe && !c.remittedArlAt) e.push("Un evento grave o mortal debe remitirse a la ARL");
  return e;
}

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");
const opt = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
export const incidentSchema = z
  .object({
    kind: z.enum(["accident", "incident"]),
    workerId: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .transform((v) => v || null),
    affectedName: opt(120),
    occurredDate: ymd,
    occurredTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Hora inválida (HH:MM)")
      .default("00:00"),
    place: z.string().trim().min(3, "Indica el lugar").max(200),
    workCenterId: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .transform((v) => v || null),
    activity: opt(300),
    description: z.string().trim().min(10, "Describe lo ocurrido (mínimo 10 caracteres)").max(5000),
    bodyPart: opt(120),
    injuryType: opt(120),
    severity: z.enum(["none", "minor", "serious", "fatal"]),
    witnesses: opt(500),
  })
  .superRefine((i, ctx) => {
    if (i.kind === "accident" && i.severity === "none")
      ctx.addIssue({
        code: "custom",
        path: ["severity"],
        message: "Un accidente implica lesión: elige leve, grave o mortal",
      });
    if (!i.workerId && !i.affectedName)
      ctx.addIssue({
        code: "custom",
        path: ["affectedName"],
        message: "Indica quién fue la persona afectada",
      });
  });
export type IncidentInput = z.input<typeof incidentSchema>;

export const diseaseSchema = z.object({
  workerId: z.uuid(),
  diagnosis: z.string().trim().min(3, "Indica el diagnóstico").max(300),
  detectedOn: ymd,
  isNew: z
    .union([z.boolean(), z.enum(["on", "yes"])])
    .optional()
    .transform((v) => v === true || v === "on" || v === "yes"),
});
export type DiseaseInput = z.input<typeof diseaseSchema>;
