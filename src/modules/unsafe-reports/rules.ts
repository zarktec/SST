import { z } from "zod";

export const KINDS = [
  { value: "condition", label: "Condición insegura" },
  { value: "act", label: "Acto inseguro" },
] as const;
export const SEVERITIES = [
  { value: "low", label: "Baja" },
  { value: "medium", label: "Media" },
  { value: "high", label: "Alta" },
] as const;
export const STATUS_LABEL: Record<string, string> = {
  new: "Nuevo",
  actioned: "Con acción",
  dismissed: "Descartado",
};

const id = z
  .union([z.uuid(), z.literal("")])
  .optional()
  .transform((v) => v || null);
const coord = (min: number, max: number) =>
  z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .refine(
      (v) => v === null || (Number.isFinite(v) && v >= min && v <= max),
      "Coordenada inválida",
    );

/** Formulario corto (menos de 30 s en el celular): solo la descripción es obligatoria. */
export const reportSchema = z.object({
  kind: z.enum(["act", "condition"]),
  description: z.string().trim().min(5, "Describe lo que viste (mínimo 5 caracteres)").max(2000),
  place: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || null),
  workCenterId: id,
  severity: z.enum(["low", "medium", "high"]).default("medium"),
  latitude: coord(-90, 90),
  longitude: coord(-180, 180),
  anonymous: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === "on" || v === "true"),
});
export type ReportInput = z.input<typeof reportSchema>;

export const reviewSchema = z.discriminatedUnion("decision", [
  z.object({
    decision: z.literal("action"),
    title: z.string().trim().min(5, "Describe la acción").max(200),
    responsibleName: z.string().trim().min(2, "Indica el responsable").max(120),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
    note: z.string().trim().max(1000).optional(),
  }),
  z.object({
    decision: z.literal("dismiss"),
    note: z.string().trim().min(5, "Explica por qué se descarta").max(1000),
  }),
]);
export type ReviewInput = z.infer<typeof reviewSchema>;
