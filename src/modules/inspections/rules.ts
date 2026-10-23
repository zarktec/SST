import { z } from "zod";
import type { ChecklistItem } from "@/core/db/schema/inspections";

/** Una línea por ítem; el prefijo `*` marca el ítem como obligatorio. */
export function parseItems(text: string): ChecklistItem[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      const required = l.startsWith("*");
      return { id: `i${i + 1}`, text: l.replace(/^\*\s*/, "").trim(), required };
    })
    .filter((i) => i.text.length >= 2);
}
export const itemsToText = (items: ChecklistItem[]) =>
  items.map((i) => `${i.required ? "* " : ""}${i.text}`).join("\n");

export const templateSchema = z.object({
  name: z.string().trim().min(3, "Indica el nombre").max(120),
  category: z.string().trim().min(2, "Indica la categoría").max(80),
  itemsText: z
    .string()
    .refine((t) => parseItems(t).length >= 1, "Agrega al menos un ítem (uno por línea)"),
});
export type TemplateInput = z.input<typeof templateSchema>;

const resultItem = z.object({
  itemId: z.string().min(1),
  result: z.enum(["ok", "fail", "na"]),
  note: z.string().trim().max(1000).nullish(),
});
export const submissionSchema = z.object({
  /** Identificador generado en el dispositivo para que el reenvío sea idempotente. */
  offlineId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/, "Identificador inválido"),
  templateId: z.uuid(),
  performedAt: z.iso.datetime({ offset: true }),
  place: z.string().trim().min(2, "Indica el lugar").max(200),
  workCenterId: z.uuid().nullish(),
  notes: z.string().trim().max(2000).nullish(),
  responsibleName: z.string().trim().max(120).nullish(),
  results: z.array(resultItem).min(1).max(300),
});
export type Submission = z.infer<typeof submissionSchema>;

/**
 * Valida las respuestas contra la plantilla: todo ítem obligatorio debe responderse (cumple o no cumple) y todo hallazgo
 * ("no cumple") debe describirse. Devuelve los errores en español, vacío si es válida.
 */
export function submissionErrors(
  items: ChecklistItem[],
  results: { itemId: string; result: string; note?: string | null }[],
): string[] {
  const e: string[] = [];
  const by = new Map(results.map((r) => [r.itemId, r]));
  for (const r of results) if (!items.some((i) => i.id === r.itemId)) e.push("Ítem desconocido");
  for (const i of items) {
    const r = by.get(i.id);
    if (i.required && (!r || r.result === "na")) e.push(`Responde el ítem obligatorio: ${i.text}`);
    if (r?.result === "fail" && !r.note?.trim()) e.push(`Describe el hallazgo: ${i.text}`);
  }
  return e;
}

export function summarize(results: { result: string }[]) {
  const ok = results.filter((r) => r.result === "ok").length;
  const fail = results.filter((r) => r.result === "fail").length;
  return { ok, fail, compliancePct: ok + fail ? Math.round((ok / (ok + fail)) * 100) : null };
}
