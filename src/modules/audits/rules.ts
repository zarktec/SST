import { z } from "zod";
import type { AuditItem } from "@/core/db/schema/audits";

export const RESULTS = [
  { value: "conforms", label: "Conforme" },
  { value: "minor_nc", label: "No conformidad menor" },
  { value: "major_nc", label: "No conformidad mayor" },
  { value: "observation", label: "Observación" },
  { value: "na", label: "No aplica" },
] as const;

export const parseItems = (text: string): AuditItem[] =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3)
    .map((l, i) => ({ id: `a${i + 1}`, text: l }));

/** Requisitos para cerrar: auditor, participación del COPASST/Vigía, todos los ítems evaluados, no conformidades descritas e informe. */
export function closeBlockers(a: {
  auditorName: string | null;
  committeeParticipant: string | null;
  checklist: AuditItem[];
  report: string | null;
  performedOn: string | null;
}): string[] {
  const e: string[] = [];
  if (!a.performedOn) e.push("Indica la fecha de realización");
  if (!a.auditorName?.trim()) e.push("Indica el auditor");
  if (!a.committeeParticipant?.trim())
    e.push("Indica el integrante del COPASST o Vigía que participó");
  const pending = a.checklist.filter((i) => !i.result);
  if (pending.length) e.push(`Faltan ${pending.length} ítem(s) por evaluar`);
  for (const i of a.checklist)
    if ((i.result === "minor_nc" || i.result === "major_nc") && !i.note?.trim())
      e.push(`Describe el hallazgo: ${i.text}`);
  if ((a.report ?? "").trim().length < 20)
    e.push("Redacta el informe de auditoría (mínimo 20 caracteres)");
  return e;
}

export const findingsOf = (items: AuditItem[]) =>
  items.filter(
    (i) => i.result === "minor_nc" || i.result === "major_nc" || i.result === "observation",
  );

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");
const optText = (max = 3000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
export const auditSchema = z.object({
  title: z.string().trim().min(5, "Indica el nombre de la auditoría").max(200),
  scope: optText(1000),
  plannedOn: ymd,
  /** Un ítem por línea. */
  itemsText: z.string().optional().default(""),
  fromAssessment: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === "on"),
});
export const auditExecutionSchema = z.object({
  performedOn: ymd,
  auditorName: z.string().trim().min(3, "Indica el auditor").max(120),
  committeeParticipant: z
    .string()
    .trim()
    .min(3, "Indica quién participó por el COPASST o Vigía")
    .max(120),
  report: optText(5000),
});

export const reviewSchema = z.object({
  heldOn: ymd,
  attendees: z.string().trim().min(5, "Indica quiénes asistieron").max(1000),
  legalChanges: optText(),
  stakeholderComms: optText(),
  objectivesCompliance: optText(),
  conclusions: optText(),
  /** Una decisión por línea: cada una crea una acción de mejora. */
  decisions: optText(),
  responsibleName: optText(120),
  dueDate: z
    .union([z.literal(""), ymd])
    .optional()
    .transform((v) => v || null),
});

/** Requisitos para firmar la revisión. */
export function signBlockers(r: {
  conclusions: string | null;
  decisions: string | null;
  attendees: string;
}): string[] {
  const e: string[] = [];
  if (!r.attendees.trim()) e.push("Indica los asistentes");
  if ((r.conclusions ?? "").trim().length < 10) e.push("Redacta las conclusiones");
  if ((r.decisions ?? "").trim().length < 5) e.push("Registra las decisiones");
  return e;
}
