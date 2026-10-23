import { z } from "zod";

export const COMPLIANCE = ["pending", "cumple", "parcial", "no_cumple"] as const;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");
const opt = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => v || null);

export const entrySchema = z
  .object({
    kind: z.enum(["norm", "requirement"]),
    code: z.string().trim().min(3),
    applies: z.enum(["yes", "no"]),
    justification: opt,
    compliance: z.enum(COMPLIANCE).default("pending"),
    evidence: opt,
    responsibleName: opt,
    nextReviewDate: z
      .union([date, z.literal("").transform(() => null)])
      .optional()
      .transform((v) => v ?? null),
    notes: opt,
  })
  .superRefine((e, ctx) => {
    if (e.applies === "no" && !e.justification)
      ctx.addIssue({
        code: "custom",
        path: ["justification"],
        message: "Si no aplica, explica por qué",
      });
    if (
      e.applies === "yes" &&
      (e.compliance === "cumple" || e.compliance === "parcial") &&
      !e.evidence
    )
      ctx.addIssue({
        code: "custom",
        path: ["evidence"],
        message: "Registra la evidencia de cumplimiento",
      });
  })
  .transform((e) =>
    e.applies === "no" ? { ...e, compliance: "pending" as const, evidence: null } : e,
  );
export type EntryInput = z.input<typeof entrySchema>;

export type MatrixRow = {
  kind: "norm" | "requirement";
  code: string;
  entry: { applies: string; compliance: string; nextReviewDate: string | null } | null;
};

/**
 * Resumen de la matriz: sin evaluar (incluye las normas nuevas publicadas por el SUPER ADMIN), no aplican, y por estado
 * de cumplimiento de las que aplican. `reviewDue` cuenta las que tienen la fecha de revisión vencida.
 */
export function summarize(rows: MatrixRow[], today: string) {
  const s = {
    total: rows.length,
    unevaluated: 0,
    notApplicable: 0,
    cumple: 0,
    parcial: 0,
    noCumple: 0,
    pendingCompliance: 0,
    reviewDue: 0,
    compliancePct: 0,
  };
  for (const r of rows) {
    if (!r.entry) s.unevaluated++;
    else if (r.entry.applies === "no") s.notApplicable++;
    else if (r.entry.compliance === "cumple") s.cumple++;
    else if (r.entry.compliance === "parcial") s.parcial++;
    else if (r.entry.compliance === "no_cumple") s.noCumple++;
    else s.pendingCompliance++;
    if (r.entry?.nextReviewDate && r.entry.nextReviewDate < today) s.reviewDue++;
  }
  const applicable = s.cumple + s.parcial + s.noCumple + s.pendingCompliance;
  s.compliancePct = applicable ? Math.round((s.cumple / applicable) * 10000) / 100 : 0;
  return s;
}
