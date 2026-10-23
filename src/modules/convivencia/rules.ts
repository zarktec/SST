import { z } from "zod";

export const STAGES = [
  "received",
  "summoned",
  "hearing",
  "agreement",
  "no_agreement",
  "follow_up",
  "closed",
  "referred",
] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = {
  received: "Recibida",
  summoned: "Citación a las partes",
  hearing: "Reunión de las partes",
  agreement: "Acuerdo de conciliación",
  no_agreement: "Sin acuerdo",
  follow_up: "Seguimiento del acuerdo",
  closed: "Cerrada",
  referred: "Remitida a otra instancia",
};

/**
 * Transiciones válidas del trámite ante el Comité de Convivencia (Resolución 3461 de 2025; Ley 1010 de 2006, art. 9).
 * TODO-NORMA: validar el flujo exacto con un experto SST.
 */
const NEXT: Record<Stage, Stage[]> = {
  received: ["summoned", "closed", "referred"],
  summoned: ["hearing", "closed", "referred"],
  hearing: ["agreement", "no_agreement"],
  agreement: ["follow_up", "closed"],
  no_agreement: ["referred", "closed"],
  follow_up: ["closed", "referred"],
  closed: [],
  referred: [],
};
export const nextStages = (s: Stage): Stage[] => NEXT[s];
export const isFinal = (s: Stage) => NEXT[s].length === 0;

/** Días para completar la etapa que sigue (parametrizables; valores provisionales TODO-NORMA). */
export type StageDays = { citacion: number; reunion: number; seguimiento: number };
export const DEFAULT_STAGE_DAYS: StageDays = { citacion: 5, reunion: 10, seguimiento: 30 };

/** Fecha límite de la etapa a la que se pasa; null si la etapa no tiene plazo. */
export function dueAfter(stage: Stage, from: Date, d: StageDays): Date | null {
  const days =
    stage === "received"
      ? d.citacion
      : stage === "summoned"
        ? d.reunion
        : stage === "follow_up"
          ? d.seguimiento
          : null;
  return days === null ? null : new Date(from.getTime() + days * 86_400_000);
}

export const isOverdue = (c: { stage: string; stageDueAt: Date | null }, now: Date) =>
  !isFinal(c.stage as Stage) && Boolean(c.stageDueAt) && c.stageDueAt! < now;

/**
 * Un integrante del comité no puede haber sido denunciado ni víctima de acoso laboral en el año anterior (spec; Resolución 3461
 * de 2025). Devuelve los trabajadores con quejas en la ventana.
 */
export function ineligibleForCommittee(
  workerIds: string[],
  complaints: {
    complainantWorkerId: string | null;
    respondentWorkerId: string | null;
    receivedAt: Date;
  }[],
  now: Date,
  windowDays = 365,
): string[] {
  const since = now.getTime() - windowDays * 86_400_000;
  const involved = new Set<string>();
  for (const c of complaints) {
    if (c.receivedAt.getTime() < since) continue;
    if (c.complainantWorkerId) involved.add(c.complainantWorkerId);
    if (c.respondentWorkerId) involved.add(c.respondentWorkerId);
  }
  return workerIds.filter((w) => involved.has(w));
}

/**
 * Conformación del CCL: mínimo de principales y suplentes por parte (parametrizable). TODO-NORMA: la Resolución 3461 de 2025
 * fija la cantidad según el tamaño de la empresa; mientras no haya texto oficial se usan los mínimos configurados.
 */
export function validateCclSize(
  counts: {
    employerPrincipal: number;
    workersPrincipal: number;
    employerAlternate: number;
    workersAlternate: number;
  },
  min: { principal: number; alternate: number },
): string[] {
  const e: string[] = [];
  if (counts.employerPrincipal < min.principal || counts.workersPrincipal < min.principal)
    e.push(`Cada parte debe tener al menos ${min.principal} principal(es)`);
  if (counts.employerAlternate < min.alternate || counts.workersAlternate < min.alternate)
    e.push(`Cada parte debe tener al menos ${min.alternate} suplente(s)`);
  return e;
}

export const complaintSchema = z.object({
  narrative: z
    .string()
    .trim()
    .min(20, "Describe los hechos con algo más de detalle (mínimo 20 caracteres)")
    .max(10_000),
  anonymous: z
    .union([z.boolean(), z.enum(["on", "yes"])])
    .optional()
    .transform((v) => v === true || v === "on" || v === "yes"),
  respondentWorkerId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => v || null),
  workCenterId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => v || null),
});
export type ComplaintInput = z.input<typeof complaintSchema>;

export const harassmentSchema = z.object({
  narrative: z
    .string()
    .trim()
    .min(20, "Describe los hechos con algo más de detalle (mínimo 20 caracteres)")
    .max(10_000),
  anonymous: z
    .union([z.boolean(), z.enum(["on", "yes"])])
    .optional()
    .transform((v) => v === true || v === "on" || v === "yes"),
});
export type HarassmentInput = z.input<typeof harassmentSchema>;
