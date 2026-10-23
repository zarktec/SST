import { z } from "zod";

/** Dígito de verificación de un NIT (algoritmo DIAN: pesos 3,7,13,17,19,23,29,37,41,43,47,53,59,67,71 de derecha a izquierda). */
export function nitCheckDigit(nit: string): number {
  if (!/^\d{1,15}$/.test(nit)) throw new Error("NIT inválido: solo dígitos (máx. 15)");
  const weights = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];
  const sum = [...nit].reverse().reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
  const r = sum % 11;
  return r > 1 ? 11 - r : r;
}

export const ID_TYPES = [
  { code: "13", label: "Cédula de ciudadanía", forCompany: false },
  { code: "22", label: "Cédula de extranjería", forCompany: false },
  { code: "31", label: "NIT", forCompany: true },
  { code: "41", label: "Pasaporte", forCompany: false },
  { code: "12", label: "Tarjeta de identidad", forCompany: false },
  { code: "42", label: "Documento de identificación extranjero", forCompany: false },
] as const;

/** Responsabilidades fiscales (códigos DIAN) admitidas. TODO-NORMA: confirmar la lista vigente con un contador. */
export const FISCAL_RESPONSIBILITIES = [
  { code: "O-13", label: "Gran contribuyente" },
  { code: "O-15", label: "Autorretenedor" },
  { code: "O-23", label: "Agente de retención IVA" },
  { code: "O-47", label: "Régimen simple de tributación" },
  { code: "R-99-PN", label: "No aplica – Otros" },
] as const;

/** Códigos DANE de departamento (33). TODO: cargar el catálogo completo de municipios como catálogo versionado. */
export const DANE_STATES = [
  "05",
  "08",
  "11",
  "13",
  "15",
  "17",
  "18",
  "19",
  "20",
  "23",
  "25",
  "27",
  "41",
  "44",
  "47",
  "50",
  "52",
  "54",
  "63",
  "66",
  "68",
  "70",
  "73",
  "76",
  "81",
  "85",
  "86",
  "88",
  "91",
  "94",
  "95",
  "97",
  "99",
];

const digits = (min: number, max: number, msg: string) =>
  z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${min},${max}}$`), msg);

export const billingProfileSchema = z
  .object({
    personType: z.enum(["Person", "Company"]),
    idType: z.enum(ID_TYPES.map((t) => t.code) as [string, ...string[]]),
    identification: digits(5, 15, "Número de documento: solo dígitos (5 a 15)"),
    checkDigit: z
      .string()
      .trim()
      .regex(/^\d$/, "Dígito de verificación inválido")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    legalName: z.string().trim().min(3, "Indica la razón social o el nombre").max(160),
    address: z.string().trim().min(5, "Indica la dirección").max(200),
    stateCode: z
      .string()
      .trim()
      .refine((c) => DANE_STATES.includes(c), "Departamento inválido (código DANE de 2 dígitos)"),
    cityCode: z
      .string()
      .trim()
      .regex(/^\d{5}$/, "Municipio inválido (código DANE de 5 dígitos)"),
    postalCode: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Código postal de 6 dígitos")
      .optional()
      .or(z.literal("").transform(() => undefined)),
    phone: z
      .string()
      .trim()
      .transform((p) => p.replace(/[\s()-]/g, ""))
      .pipe(z.string().regex(/^(\+?57)?\d{7,10}$/, "Teléfono inválido")),
    invoiceEmail: z
      .email("Correo de recepción de factura electrónica inválido")
      .transform((e) => e.toLowerCase()),
    fiscalResponsibilities: z
      .array(z.enum(FISCAL_RESPONSIBILITIES.map((f) => f.code) as [string, ...string[]]))
      .min(1, "Selecciona al menos una responsabilidad fiscal"),
    vatResponsible: z.boolean().default(false),
  })
  .superRefine((p, ctx) => {
    const type = ID_TYPES.find((t) => t.code === p.idType)!;
    if (p.personType === "Company" && !type.forCompany)
      ctx.addIssue({
        code: "custom",
        path: ["idType"],
        message: "Una persona jurídica se identifica con NIT",
      });
    if (p.idType === "31") {
      if (!p.checkDigit)
        return ctx.addIssue({
          code: "custom",
          path: ["checkDigit"],
          message: "El NIT requiere dígito de verificación",
        });
      let expected: number;
      try {
        expected = nitCheckDigit(p.identification);
      } catch {
        return ctx.addIssue({ code: "custom", path: ["identification"], message: "NIT inválido" });
      }
      if (Number(p.checkDigit) !== expected)
        ctx.addIssue({
          code: "custom",
          path: ["checkDigit"],
          message: `Dígito de verificación incorrecto (para este NIT es ${expected})`,
        });
    }
    if (!p.cityCode.startsWith(p.stateCode))
      ctx.addIssue({
        code: "custom",
        path: ["cityCode"],
        message: "El municipio no pertenece al departamento",
      });
  });

export type BillingProfileInput = z.input<typeof billingProfileSchema>;
export type BillingProfileData = z.output<typeof billingProfileSchema>;
