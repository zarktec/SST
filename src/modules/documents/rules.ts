import { createHash } from "node:crypto";
import { z } from "zod";
import { addMonths } from "@/lib/dates";

export const KINDS = [
  { value: "policy", label: "Política" },
  { value: "procedure", label: "Procedimiento" },
  { value: "program", label: "Programa" },
  { value: "manual", label: "Manual" },
  { value: "format", label: "Formato" },
  { value: "other", label: "Otro" },
] as const;

export const bodyHash = (body: string) =>
  createHash("sha256").update(body.normalize("NFC")).digest("hex");

export type ReviewState = "vigente" | "por_revisar" | "sin_revision" | "sin_aprobar";
/** Vigencia del documento: la versión aprobada debe revisarse en su fecha (parametrizable; TODO-NORMA). */
export function reviewState(
  d: { currentApproved: boolean; nextReviewOn: string | null },
  today: string,
  warnDays: number,
): ReviewState {
  if (!d.currentApproved) return "sin_aprobar";
  if (!d.nextReviewOn) return "sin_revision";
  const days = Math.round((Date.parse(d.nextReviewOn) - Date.parse(today)) / 86_400_000);
  return days < 0 || days <= warnDays ? "por_revisar" : "vigente";
}

export const nextReview = (effectiveFrom: string, months: number | null) =>
  months ? addMonths(effectiveFrom, months) : null;

/** Reemplaza variables {{empresa.razonSocial}} de una plantilla; las desconocidas quedan visibles para completarlas. */
export function renderTemplate(
  body: string,
  vars: Record<string, string | null | undefined>,
): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k: string) => vars[k] ?? m);
}

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");
export const documentSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z0-9][A-Z0-9._-]{1,29}$/,
      "Código inválido (letras, números, punto, guion; 2 a 30)",
    ),
  title: z.string().trim().min(3, "Indica el título").max(200),
  kind: z.enum(["policy", "procedure", "program", "manual", "format", "other"]),
  ownerName: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v || null),
  reviewMonths: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(120)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  body: z
    .string()
    .trim()
    .min(10, "Redacta el contenido del documento (mínimo 10 caracteres)")
    .max(100_000),
});
export const versionSchema = z.object({
  body: z
    .string()
    .trim()
    .min(10, "Redacta el contenido del documento (mínimo 10 caracteres)")
    .max(100_000),
  changeNote: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null),
});
export const approveSchema = z.object({ effectiveFrom: ymd });
