import { z } from "zod";

export const REQUEST_TYPES = [
  { value: "query", label: "Consulta de mis datos" },
  { value: "rectification", label: "Rectificación o actualización" },
  { value: "deletion", label: "Supresión (cuando la ley lo permita)" },
] as const;

/**
 * Aviso de privacidad GENÉRICO y PROVISIONAL (TODO-NORMA): la empresa debe revisarlo con su asesor jurídico y completarlo con su
 * política de tratamiento de datos (Ley 1581 de 2012 y Decreto 1377 de 2013).
 */
export const PRIVACY_NOTICE = [
  "Esta plataforma trata datos personales de trabajadores, contratistas y usuarios para gestionar el Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) de tu empresa, cumplir obligaciones legales y atender emergencias.",
  "Los datos de salud (evaluaciones médicas ocupacionales, restricciones, casos de vigilancia epidemiológica, ausentismo) son datos sensibles: se guardan cifrados, solo acceden las personas autorizadas y cada consulta queda registrada. No estás obligado a autorizar su tratamiento, pero algunas funciones de seguridad y salud dependen de él.",
  "Como titular puedes consultar, actualizar, rectificar o solicitar la supresión de tus datos (cuando la ley lo permita) desde esta sección. Algunos registros del SG-SST deben conservarse por 20 años desde la terminación de la relación laboral (Decreto 1072 de 2015, art. 2.2.4.6.13).",
];

export const consentSchema = z.object({
  general: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === "on"),
  sensitive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === "on"),
});
export const requestSchema = z.object({
  type: z.enum(["query", "rectification", "deletion"]),
  detail: z.string().trim().min(10, "Describe tu solicitud (mínimo 10 caracteres)").max(2000),
});
export const resolveSchema = z.object({
  decision: z.enum(["resolved", "rejected"]),
  resolution: z
    .string()
    .trim()
    .min(10, "Escribe la respuesta al titular (mínimo 10 caracteres)")
    .max(2000),
});
