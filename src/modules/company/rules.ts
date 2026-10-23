import { z } from "zod";
import { nitCheckDigit } from "@/modules/billing/billing-profile";

export type SizeRiskRule = {
  group: 7 | 21 | 60;
  priority: number;
  minWorkers: number | null;
  maxWorkers: number | null;
  riskClasses: number[];
};

/**
 * Grupo de estándares mínimos que aplica (7, 21 o 60). Las reglas son datos (catálogo `size_risk_groups`,
 * Resolución 0312 de 2019, arts. 3 a 5) y se evalúan por prioridad; gana la primera que coincide.
 * TODO-NORMA: validación de los umbrales por un experto SST.
 */
export function classifyStandards(
  input: { workers: number; riskClass: number },
  rules: SizeRiskRule[],
): 7 | 21 | 60 | null {
  if (!Number.isInteger(input.workers) || input.workers < 0) return null;
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const r of sorted) {
    if (!r.riskClasses.includes(input.riskClass)) continue;
    if (r.minWorkers !== null && input.workers < r.minWorkers) continue;
    if (r.maxWorkers !== null && input.workers > r.maxWorkers) continue;
    return r.group;
  }
  return null;
}

/** Clase de riesgo efectiva: la más alta entre la de la empresa y la de sus sedes. */
export const effectiveRiskClass = (
  company: number | null,
  centers: (number | null)[],
): number | null => {
  const all = [company, ...centers].filter((n): n is number => typeof n === "number");
  return all.length ? Math.max(...all) : null;
};

const ymd = /^\d{4}-\d{2}-\d{2}$/;
export function addYears(date: string, years: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const out = new Date(Date.UTC(y + years, m - 1, d));
  // 29 de febrero + años no bisiestos → 28 de febrero (no se desborda a marzo).
  if (out.getUTCMonth() !== m - 1) out.setUTCDate(0);
  return out.toISOString().slice(0, 10);
}
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

export type ResponsibleData = {
  licenseNumber: string | null;
  licenseValidUntil: string | null;
  course50hDate: string | null;
  refresher20hDate: string | null;
};
export type ResponsibleParams = { refresherYears: number; warnDays: number };
export type ResponsibleStatus = {
  ok: boolean;
  issues: string[];
  /** Fecha en que vence la actualización de 20 horas (null si no hay curso de 50 h). */
  refresherDue: string | null;
  refresherState: "vigente" | "por_vencer" | "vencida" | "sin_datos";
};

/**
 * Estado del responsable del SG-SST: licencia vigente, curso de 50 horas y actualización de 20 horas cada 3 años
 * (Resolución 4927 de 2016 y Circular 047 de 2025; periodicidad parametrizable). TODO-NORMA: el perfil mínimo exigido
 * según tamaño y riesgo de la empresa aún no se valida (se requiere experto SST).
 */
export function evaluateResponsible(
  r: ResponsibleData,
  today: string,
  params: ResponsibleParams,
): ResponsibleStatus {
  const issues: string[] = [];
  if (!r.licenseNumber) issues.push("Falta el número de la licencia en SST");
  if (!r.licenseValidUntil) issues.push("Falta la vigencia de la licencia");
  else if (r.licenseValidUntil < today) issues.push("La licencia en SST está vencida");
  let refresherDue: string | null = null;
  let refresherState: ResponsibleStatus["refresherState"] = "sin_datos";
  if (!r.course50hDate) issues.push("Falta el certificado del curso de 50 horas");
  else {
    refresherDue = addYears(r.refresher20hDate ?? r.course50hDate, params.refresherYears);
    const left = daysBetween(today, refresherDue);
    refresherState = left < 0 ? "vencida" : left <= params.warnDays ? "por_vencer" : "vigente";
    if (refresherState === "vencida") issues.push("La actualización de 20 horas está vencida");
  }
  return { ok: issues.length === 0, issues, refresherDue, refresherState };
}

const date = z.string().regex(ymd, "Fecha inválida (AAAA-MM-DD)");
const optDate = z.union([date, z.literal("").transform(() => null), z.null()]).optional();
const optText = (max = 160) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

export const companyDataSchema = z
  .object({
    nit: z
      .string()
      .trim()
      .regex(/^\d{5,12}$/, "NIT sin dígito de verificación ni puntos"),
    nitDv: z.string().trim().regex(/^\d$/, "Dígito de verificación inválido"),
    legalName: z.string().trim().min(2).max(160),
    tradeName: z.string().trim().min(2).max(80),
    ciiu: z
      .string()
      .trim()
      .regex(/^\d{4}$/, "CIIU de 4 dígitos"),
    riskClass: z.coerce
      .number()
      .int()
      .min(1, "Clase de riesgo de 1 a 5")
      .max(5, "Clase de riesgo de 1 a 5"),
    arl: z.string().trim().min(2, "Indica la ARL").max(80),
    legalRepresentative: z.string().trim().min(3, "Indica el representante legal").max(120),
    workersCount: z.coerce.number().int().min(1, "Al menos 1 trabajador").max(1_000_000),
  })
  .superRefine((d, ctx) => {
    let dv: number;
    try {
      dv = nitCheckDigit(d.nit);
    } catch {
      return ctx.addIssue({ code: "custom", path: ["nit"], message: "NIT inválido" });
    }
    if (Number(d.nitDv) !== dv)
      ctx.addIssue({
        code: "custom",
        path: ["nitDv"],
        message: `Dígito de verificación incorrecto (para este NIT es ${dv})`,
      });
  });
export type CompanyDataInput = z.input<typeof companyDataSchema>;

export const workCenterSchema = z.object({
  name: z.string().trim().min(2, "Indica el nombre de la sede").max(120),
  address: optText(200),
  daneCityCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Municipio DANE de 5 dígitos")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  riskClass: z.coerce
    .number()
    .int()
    .min(1)
    .max(5)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  workersCount: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export const responsibleSchema = z.object({
  fullName: z.string().trim().min(3, "Indica el nombre completo").max(120),
  idType: z.enum(["13", "22", "41", "42"]),
  idNumber: z
    .string()
    .trim()
    .regex(/^\d{5,15}$/, "Documento: solo dígitos"),
  email: z.email("Correo inválido").transform((e) => e.toLowerCase()),
  phone: optText(30),
  profile: z.enum(["profesional", "tecnologo", "tecnico", "otro"]),
  licenseNumber: optText(60),
  licenseIssuer: optText(120),
  licenseValidUntil: optDate,
  course50hDate: optDate,
  course50hEntity: optText(120),
  refresher20hDate: optDate,
});
export type ResponsibleInput = z.input<typeof responsibleSchema>;
