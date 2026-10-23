import { createHash } from "node:crypto";
import { z } from "zod";

export const STATUSES = ["pending", "in_progress", "done", "cancelled"] as const;
export type ActivityStatus = (typeof STATUSES)[number];
const ymd = /^\d{4}-\d{2}-\d{2}$/;
const date = z.string().regex(ymd, "Fecha inválida (AAAA-MM-DD)");
const opt = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const activitySchema = z
  .object({
    phva: z.enum(["P", "H", "V", "A"]),
    title: z.string().trim().min(3, "Describe la actividad").max(200),
    objective: opt(),
    responsibleName: opt(120),
    startDate: date,
    endDate: date,
    resources: opt(),
    /** Presupuesto en pesos (entero); se guarda en centavos. */
    budgetPesos: z
      .union([z.literal(""), z.coerce.number().int().min(0).max(1e12)])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
  })
  .superRefine((a, ctx) => {
    if (a.endDate < a.startDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "El fin no puede ser anterior al inicio",
      });
  });
export type ActivityInput = z.input<typeof activitySchema>;

/** % de cumplimiento: realizadas sobre las programadas (las canceladas no cuentan). */
export function progress(items: { status: string }[]): {
  total: number;
  done: number;
  pct: number;
} {
  const active = items.filter((i) => i.status !== "cancelled");
  const done = active.filter((i) => i.status === "done").length;
  return {
    total: active.length,
    done,
    pct: active.length ? Math.round((done / active.length) * 10000) / 100 : 0,
  };
}

export const isOverdue = (a: { status: string; endDate: string }, today: string) =>
  (a.status === "pending" || a.status === "in_progress") && a.endDate < today;

/** Meses (1-12) del año en que la actividad está programada: base del cronograma (Gantt). */
export function monthsOf(a: { startDate: string; endDate: string }, year: number): number[] {
  const out: number[] = [];
  for (let m = 1; m <= 12; m++) {
    const first = `${year}-${String(m).padStart(2, "0")}-01`;
    const last = `${year}-${String(m).padStart(2, "0")}-31`;
    if (a.startDate <= last && a.endDate >= first) out.push(m);
  }
  return out;
}

type HashItem = {
  phva: string;
  title: string;
  objective: string | null;
  responsibleName: string | null;
  startDate: string;
  endDate: string;
  resources: string | null;
  budgetCents: bigint | null;
  status: string;
};
/** Huella del contenido del plan: cambia si se modifica cualquier actividad programada (las canceladas se excluyen). */
export function contentHash(year: number, items: HashItem[]): string {
  const canon = items
    .filter((i) => i.status !== "cancelled")
    .map((i) =>
      [
        i.phva,
        i.title,
        i.objective ?? "",
        i.responsibleName ?? "",
        i.startDate,
        i.endDate,
        i.resources ?? "",
        String(i.budgetCents ?? ""),
      ].join("|"),
    )
    .sort();
  return createHash("sha256")
    .update(`${year}\n${canon.join("\n")}`)
    .digest("hex");
}

/** Actividad sugerida a partir de una acción de mejoramiento: plazo = fecha límite o el cierre del año. */
export function suggestFromImprovement(
  i: { id: string; description: string; responsibleName: string | null; dueDate: string | null },
  year: number,
) {
  const end = i.dueDate && i.dueDate.startsWith(String(year)) ? i.dueDate : `${year}-12-31`;
  return {
    source: "improvement",
    sourceId: i.id,
    phva: "A" as const,
    title: i.description.slice(0, 200),
    responsibleName: i.responsibleName,
    startDate: `${year}-01-01`,
    endDate: end,
  };
}

/** Actividad sugerida para un peligro con riesgo no aceptable (nivel I o II). */
export function suggestFromHazard(
  h: {
    id: string;
    hazardName: string;
    task: string;
    riskLevel: string | null;
    ctrlEliminationOrBetter: string | null;
  },
  year: number,
) {
  if (h.riskLevel !== "I" && h.riskLevel !== "II") return null;
  const q1 = h.riskLevel === "I" ? `${year}-03-31` : `${year}-06-30`;
  return {
    source: "hazard",
    sourceId: h.id,
    phva: "H" as const,
    title: `Controlar riesgo ${h.riskLevel}: ${h.hazardName} (${h.task})`.slice(0, 200),
    objective: h.ctrlEliminationOrBetter,
    startDate: `${year}-01-01`,
    endDate: q1,
  };
}
