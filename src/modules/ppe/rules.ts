import { z } from "zod";
import { hashEvidence, isValidSignature } from "@/core/signature";
import { addMonths, daysBetween } from "@/lib/dates";

export { isValidSignature };
export const REASONS = [
  { value: "first", label: "Primera entrega" },
  { value: "replacement", label: "Reposición por vida útil" },
  { value: "deterioration", label: "Reposición por deterioro" },
  { value: "loss", label: "Reposición por pérdida" },
] as const;

const opt = (max = 300) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");

export const itemSchema = z.object({
  name: z.string().trim().min(2, "Indica el nombre del EPP").max(120),
  category: opt(80),
  usefulLifeMonths: z
    .union([z.literal(""), z.coerce.number().int().min(1).max(120)])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  requiresSize: z
    .union([z.boolean(), z.enum(["on", "yes"])])
    .optional()
    .transform((v) => v === true || v === "on" || v === "yes"),
  minStock: z.coerce.number().int().min(0).max(1_000_000).default(0),
});
export type ItemInput = z.input<typeof itemSchema>;

export const deliverySchema = z.object({
  workerId: z.uuid(),
  itemId: z.uuid(),
  quantity: z.coerce.number().int().min(1, "Mínimo 1").max(1000).default(1),
  size: opt(20),
  reason: z.enum(["first", "replacement", "deterioration", "loss"]),
  deliveredAt: ymd,
  note: opt(500),
});
export type DeliveryInput = z.input<typeof deliverySchema>;

export const stockSchema = z.object({
  itemId: z.uuid(),
  quantity: z.coerce.number().int().min(1, "Mínimo 1").max(1_000_000),
  entryDate: ymd,
  supplier: opt(120),
  note: opt(300),
});
export type StockInput = z.input<typeof stockSchema>;

export const dueDateOf = (deliveredAt: string, usefulLifeMonths: number | null) =>
  usefulLifeMonths ? addMonths(deliveredAt, usefulLifeMonths) : null;

export type PpeState = "vigente" | "por_vencer" | "vencido" | "pendiente";
/**
 * Estado de un EPP exigido a una persona: vale la última entrega; con vida útil, vence a los N meses y se avisa
 * `warnDays` antes. (Decreto 1072 de 2015, art. 2.2.4.6.24 par. 3 — el empleador suministra y repone los EPP; la vida útil
 * es parametrizable por elemento. TODO-NORMA: validar periodicidades con un experto SST.)
 */
export function ppeState(
  deliveries: { deliveredAt: string; dueDate: string | null }[],
  today: string,
  warnDays = 30,
): { state: PpeState; dueDate: string | null; lastDelivery: string | null } {
  const last = [...deliveries].sort((a, b) => a.deliveredAt.localeCompare(b.deliveredAt)).at(-1);
  if (!last) return { state: "pendiente", dueDate: null, lastDelivery: null };
  if (!last.dueDate) return { state: "vigente", dueDate: null, lastDelivery: last.deliveredAt };
  const left = daysBetween(today, last.dueDate);
  return {
    state: left < 0 ? "vencido" : left <= warnDays ? "por_vencer" : "vigente",
    dueDate: last.dueDate,
    lastDelivery: last.deliveredAt,
  };
}

/** Stock = ingresos - entregas; `low` si está en o bajo el mínimo configurado. */
export const stockOf = (entries: number, delivered: number, min: number) => ({
  stock: entries - delivered,
  low: min > 0 && entries - delivered <= min,
});

export const deliveryHash = (e: {
  workerId: string;
  itemId: string;
  quantity: number;
  deliveredAt: string;
  signedAt: string;
  signature: string | null;
  ip: string | null;
  userAgent: string | null;
}) =>
  hashEvidence([
    e.workerId,
    e.itemId,
    String(e.quantity),
    e.deliveredAt,
    e.signedAt,
    e.signature,
    e.ip,
    e.userAgent,
  ]);
