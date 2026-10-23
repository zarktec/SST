import { z } from "zod";
import { daysBetween } from "@/lib/dates";

export const TYPES = [
  { value: "corrective", label: "Correctiva" },
  { value: "preventive", label: "Preventiva" },
  { value: "improvement", label: "De mejora" },
] as const;
export const SOURCES: Record<string, string> = {
  manual: "Manual",
  incident: "Accidente / incidente",
  inspection: "Inspección",
  unsafe_report: "Reporte de condición o acto inseguro",
  assessment: "Autoevaluación de estándares",
  audit: "Auditoría",
  pve: "Programa de vigilancia",
  drill: "Simulacro",
  complaint: "Queja",
  capa: "Eficacia no lograda",
};
export type Status = "open" | "in_progress" | "done" | "verified" | "cancelled";
export const STATUS_LABEL: Record<Status, string> = {
  open: "Abierta",
  in_progress: "En curso",
  done: "Ejecutada",
  verified: "Verificada",
  cancelled: "Cancelada",
};

const NEXT: Record<Status, Status[]> = {
  open: ["in_progress", "done", "cancelled"],
  in_progress: ["done", "cancelled"],
  done: ["verified"],
  verified: [],
  cancelled: [],
};
export const canMove = (from: Status, to: Status) => NEXT[from].includes(to);

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");
const opt = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const actionSchema = z.object({
  type: z.enum(["corrective", "preventive", "improvement"]),
  title: z.string().trim().min(5, "Describe la acción (mínimo 5 caracteres)").max(200),
  description: opt(),
  rootCause: opt(),
  responsibleName: z.string().trim().min(2, "Indica el responsable").max(120),
  dueDate: ymd,
});
export type ActionInput = z.input<typeof actionSchema>;

/** Días de mora de una acción abierta (0 si no está vencida o ya se ejecutó). */
export function daysOverdue(a: { status: string; dueDate: string }, today: string): number {
  if (a.status !== "open" && a.status !== "in_progress") return 0;
  return Math.max(0, daysBetween(a.dueDate, today));
}

export type EscalationDays = { level1: number; level2: number; level3: number };
/** Nivel de escalamiento según la mora: 1 = responsable del SG-SST, 2 = administración, 3 = alta dirección. Umbrales parametrizables. */
export function escalationLevel(overdue: number, d: EscalationDays): 0 | 1 | 2 | 3 {
  return overdue >= d.level3 ? 3 : overdue >= d.level2 ? 2 : overdue >= d.level1 ? 1 : 0;
}
export const LEVEL_ROLES: Record<1 | 2 | 3, string[]> = {
  1: ["RESPONSABLE_SST"],
  2: ["RESPONSABLE_SST", "ADMIN_EMPRESA"],
  3: ["RESPONSABLE_SST", "ADMIN_EMPRESA", "ALTA_DIRECCION"],
};

export const verifySchema = z.object({
  effective: z.enum(["yes", "no"]),
  note: z.string().trim().min(5, "Describe cómo se verificó la eficacia").max(1000),
});
