import { z } from "zod";
import type { PermitChecklistItem } from "@/core/db/schema/high-risk";
import { addMonths } from "@/lib/dates";

export const KINDS = [
  { value: "heights", label: "Trabajo en alturas" },
  { value: "confined", label: "Espacios confinados" },
  { value: "hot_work", label: "Trabajo en caliente" },
  { value: "electrical", label: "Trabajo eléctrico" },
  { value: "other", label: "Otro" },
] as const;

/**
 * Tipos predeterminados. Las listas de verificación son genéricas y PROVISIONALES (TODO-NORMA): cada empresa las ajusta con su
 * experto; para alturas se tomó como referencia la Resolución 4272 de 2021 (certificación y coordinador).
 */
export const DEFAULT_TYPES: {
  kind: string;
  name: string;
  requiresCertificate: boolean;
  requiresRescuePlan: boolean;
  maxHours: number;
  items: [string, boolean][];
}[] = [
  {
    kind: "heights",
    name: "Trabajo en alturas",
    requiresCertificate: true,
    requiresRescuePlan: true,
    maxHours: 8,
    items: [
      ["Sistema de protección contra caídas inspeccionado antes del uso", true],
      ["Puntos de anclaje identificados y verificados", true],
      ["Área demarcada y señalizada bajo la zona de trabajo", true],
      ["Condiciones climáticas verificadas", false],
      ["Plan de rescate conocido por el equipo", true],
    ],
  },
  {
    kind: "confined",
    name: "Espacios confinados",
    requiresCertificate: false,
    requiresRescuePlan: true,
    maxHours: 8,
    items: [
      ["Medición de atmósfera realizada antes de ingresar", true],
      ["Ventilación dispuesta", true],
      ["Vigía asignado en el exterior", true],
      ["Energías peligrosas bloqueadas y etiquetadas", true],
    ],
  },
  {
    kind: "hot_work",
    name: "Trabajo en caliente",
    requiresCertificate: false,
    requiresRescuePlan: false,
    maxHours: 8,
    items: [
      ["Área libre de combustibles o protegida", true],
      ["Extintor disponible en el sitio", true],
      ["Vigilante de fuego asignado", true],
    ],
  },
  {
    kind: "electrical",
    name: "Trabajo eléctrico",
    requiresCertificate: false,
    requiresRescuePlan: false,
    maxHours: 8,
    items: [
      ["Circuito desenergizado, bloqueado y etiquetado", true],
      ["Ausencia de tensión verificada", true],
      ["EPP dieléctrico en buen estado", true],
    ],
  },
];

/** Vigencia del certificado: desde la expedición + meses (TODO-NORMA, parametrizable `alturas.vigencia_certificado_meses`). */
export const certificateExpiry = (issuedOn: string, months: number) => addMonths(issuedOn, months);
export const certificateValidOn = (c: { expiresOn: string; issuedOn: string }, date: string) =>
  c.issuedOn <= date && c.expiresOn >= date;

export type PermitState =
  "solicitado" | "programado" | "vigente" | "vencido" | "cerrado" | "cancelado";
/** Estado visible del permiso: uno autorizado cuya hora final pasó sin cerrarse queda "vencido" y debe cerrarse. */
export function permitState(
  p: { status: string; validFrom: Date; validUntil: Date },
  now: Date,
): PermitState {
  if (p.status === "requested") return "solicitado";
  if (p.status === "closed") return "cerrado";
  if (p.status === "cancelled") return "cancelado";
  if (now < p.validFrom) return "programado";
  return now > p.validUntil ? "vencido" : "vigente";
}

export type AuthorizeCheck = {
  requiresCertificate: boolean;
  requiresRescuePlan: boolean;
  maxHours: number;
  checklist: PermitChecklistItem[];
  rescuePlan: string | null;
  validFrom: Date;
  validUntil: Date;
  workers: { workerId: string; name: string }[];
  coordinatorWorkerId: string | null;
  certificates: { workerId: string; level: string; issuedOn: string; expiresOn: string }[];
  /** Fecha (Bogotá) en la que se ejecuta el trabajo: los certificados deben estar vigentes ese día. */
  workDate: string;
};

/** Requisitos para autorizar el permiso. Devuelve los motivos de bloqueo en español (vacío = se puede autorizar). */
export function authorizeBlockers(c: AuthorizeCheck): string[] {
  const e: string[] = [];
  if (c.validUntil <= c.validFrom) e.push("La hora final debe ser posterior a la inicial");
  else if ((c.validUntil.getTime() - c.validFrom.getTime()) / 3_600_000 > c.maxHours)
    e.push(`El permiso no puede durar más de ${c.maxHours} horas`);
  for (const i of c.checklist) {
    if (i.required && i.answer !== "ok" && i.answer !== "na")
      e.push(`Lista de verificación: ${i.text}`);
    if (i.required && i.answer === "na")
      e.push(`Lista de verificación: ${i.text} no puede ser "no aplica"`);
  }
  if (!c.workers.length) e.push("Indica las personas que realizarán el trabajo");
  if (c.requiresRescuePlan && !c.rescuePlan?.trim()) e.push("Falta el plan de rescate");
  if (c.requiresCertificate) {
    for (const w of c.workers) {
      const ok = c.certificates.some(
        (x) => x.workerId === w.workerId && certificateValidOn(x, c.workDate),
      );
      if (!ok) e.push(`${w.name} no tiene certificado de alturas vigente`);
    }
    if (!c.coordinatorWorkerId) e.push("Falta el coordinador de trabajo en alturas");
    else if (
      !c.certificates.some(
        (x) =>
          x.workerId === c.coordinatorWorkerId &&
          x.level === "coordinator" &&
          certificateValidOn(x, c.workDate),
      )
    )
      e.push("El coordinador no tiene certificado de coordinador vigente");
  }
  return e;
}

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");
const optText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
const optId = z
  .union([z.uuid(), z.literal("")])
  .optional()
  .transform((v) => v || null);

export const typeSchema = z.object({
  kind: z.enum(["heights", "confined", "hot_work", "electrical", "other"]),
  name: z.string().trim().min(3, "Indica el nombre").max(100),
  maxHours: z.coerce.number().int().min(1).max(72),
  requiresCertificate: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === "on"),
  requiresRescuePlan: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === "on"),
  /** Un ítem por línea; `*` al inicio = obligatorio. */
  itemsText: z
    .string()
    .refine((t) => t.split(/\r?\n/).some((l) => l.trim().length > 2), "Agrega al menos un ítem"),
});
export const parseChecklist = (text: string): PermitChecklistItem[] =>
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.replace(/^\*\s*/, "").length >= 2)
    .map((l, i) => ({
      id: `c${i + 1}`,
      text: l.replace(/^\*\s*/, ""),
      required: l.startsWith("*"),
    }));
export const checklistToText = (items: PermitChecklistItem[]) =>
  items.map((i) => `${i.required ? "* " : ""}${i.text}`).join("\n");

export const certificateSchema = z.object({
  workerId: z.uuid("Selecciona la persona"),
  level: z.enum(["authorized", "coordinator"]),
  issuer: z.string().trim().min(3, "Indica la entidad que certificó").max(150),
  issuedOn: ymd,
  expiresOn: z
    .union([z.literal(""), ymd])
    .optional()
    .transform((v) => v || null),
});
export const equipmentSchema = z.object({
  code: z.string().trim().min(1, "Indica el código").max(60),
  description: z.string().trim().min(3, "Describe el equipo").max(200),
  certifiedUntil: z
    .union([z.literal(""), ymd])
    .optional()
    .transform((v) => v || null),
});

export const requestSchema = z.object({
  typeId: z.uuid("Selecciona el tipo de permiso"),
  place: z.string().trim().min(2, "Indica el lugar").max(200),
  workCenterId: optId,
  description: z.string().trim().min(10, "Describe el trabajo a realizar").max(3000),
  /** Fecha y hora locales de Colombia: AAAA-MM-DD y HH:MM. */
  date: ymd,
  fromTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  toTime: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  coordinatorWorkerId: optId,
  rescuePlan: optText(3000),
});
