import { z } from "zod";
import { PLAN_MODULE_KEYS } from "@/core/plans/modules";

const limit = z.number().int().min(1).max(10_000_000).nullable();

/** Entrada del formulario de planes (SUPER ADMIN). Precios en pesos enteros; IVA en porcentaje. */
export const planInputSchema = z
  .object({
    key: z
      .string()
      .trim()
      .regex(/^[a-z0-9][a-z0-9_-]{1,39}$/, "Solo minúsculas, números, guion y guion bajo (2-40)"),
    name: z.string().trim().min(2, "Nombre muy corto").max(80),
    description: z.string().trim().max(500).default(""),
    isTrial: z.boolean().default(false),
    trialDays: z.number().int().min(0).max(365).nullable(),
    vatEnabled: z.boolean().default(false),
    vatIncluded: z.boolean().default(false),
    vatRatePercent: z.number().min(0).max(100).default(0),
    limits: z.object({ workers: limit, users: limit, centers: limit, storageMb: limit }),
    modules: z.array(z.enum(PLAN_MODULE_KEYS as [string, ...string[]])).default([]),
    visible: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(1000).default(0),
    active: z.boolean().default(true),
    monthlyPesos: z.number().int().min(0).max(10_000_000_000).nullable(),
    annualPesos: z.number().int().min(0).max(10_000_000_000).nullable(),
    monthlySiigoCode: z.string().trim().max(60).nullable().default(null),
    annualSiigoCode: z.string().trim().max(60).nullable().default(null),
  })
  .superRefine((p, ctx) => {
    if (!p.isTrial && p.monthlyPesos === null && p.annualPesos === null) {
      ctx.addIssue({
        code: "custom",
        path: ["monthlyPesos"],
        message: "Define al menos un precio (mensual o anual)",
      });
    }
    if (p.vatIncluded && !p.vatEnabled) {
      ctx.addIssue({
        code: "custom",
        path: ["vatIncluded"],
        message: "El IVA incluido requiere que el plan cobre IVA",
      });
    }
    if (p.vatEnabled && p.vatRatePercent <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["vatRatePercent"],
        message: "Indica el porcentaje de IVA",
      });
    }
    if (p.isTrial && (p.trialDays === null || p.trialDays < 1)) {
      ctx.addIssue({
        code: "custom",
        path: ["trialDays"],
        message: "El plan de prueba necesita una duración en días",
      });
    }
  });

export type PlanInput = z.infer<typeof planInputSchema>;

export const couponInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,32}$/, "3-32 caracteres: letras, números, guion"),
    description: z.string().trim().max(200).default(""),
    kind: z.enum(["percent", "amount"]),
    /** percent: 0-100 (admite decimales); amount: pesos enteros. */
    value: z.number().positive(),
    validFrom: z.date().nullable().default(null),
    validTo: z.date().nullable().default(null),
    maxUses: z.number().int().min(1).nullable().default(null),
    planIds: z.array(z.uuid()).default([]),
    active: z.boolean().default(true),
  })
  .superRefine((c, ctx) => {
    if (c.kind === "percent" && c.value > 100)
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "El porcentaje no puede superar 100",
      });
    if (c.kind === "amount" && !Number.isInteger(c.value))
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message: "El valor fijo va en pesos enteros",
      });
    if (c.validFrom && c.validTo && c.validTo < c.validFrom)
      ctx.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "La vigencia termina antes de empezar",
      });
  });
export type CouponInputData = z.infer<typeof couponInputSchema>;
