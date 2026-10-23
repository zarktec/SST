import { z } from "zod";

export const KINDS = [
  { value: "employee", label: "Trabajador" },
  { value: "apprentice", label: "Aprendiz" },
  { value: "contractor", label: "Contratista" },
] as const;
export const CONTRACT_TYPES = [
  { value: "indefinido", label: "Término indefinido" },
  { value: "fijo", label: "Término fijo" },
  { value: "obra_labor", label: "Obra o labor" },
  { value: "prestacion_servicios", label: "Prestación de servicios" },
  { value: "aprendizaje", label: "Aprendizaje" },
  { value: "otro", label: "Otro" },
] as const;
export const ID_TYPES = ["13", "22", "41", "12", "42", "31"] as const;

const ymd = /^\d{4}-\d{2}-\d{2}$/;
/** Acepta AAAA-MM-DD y DD/MM/AAAA (Excel en español); devuelve AAAA-MM-DD o null si no es una fecha real. */
export function normalizeDate(v: string): string | null {
  const s = v.trim();
  let iso = s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (!ymd.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso;
}

const text = (max = 120) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
const dateField = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = normalizeDate(v);
    if (!d) ctx.addIssue({ code: "custom", message: "Fecha inválida (AAAA-MM-DD)" });
    return d;
  });

export const workerSchema = z
  .object({
    kind: z.enum(["employee", "apprentice", "contractor"]),
    idType: z.enum(ID_TYPES),
    idNumber: z
      .string()
      .trim()
      .regex(/^\d{5,15}$/, "Documento: solo dígitos (5 a 15)"),
    fullName: z.string().trim().min(3, "Indica el nombre completo").max(120),
    email: z
      .union([
        z.email("Correo inválido").transform((e) => e.toLowerCase()),
        z.literal("").transform(() => null),
      ])
      .optional()
      .transform((v) => v ?? null),
    phone: text(30),
    position: text(),
    area: text(),
    workCenterId: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .transform((v) => v || null),
    contractType: z
      .union([z.enum(CONTRACT_TYPES.map((c) => c.value) as [string, ...string[]]), z.literal("")])
      .optional()
      .transform((v) => v || null),
    startDate: dateField.refine(
      (d) => d !== null,
      "Indica la fecha de ingreso",
    ) as z.ZodType<string>,
    endDate: dateField.optional().transform((v) => v ?? null),
    eps: text(),
    afp: text(),
    arl: text(),
    arlRiskClass: z
      .union([z.coerce.number().int().min(1).max(5), z.literal("")])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    ccf: text(),
    contractorCompany: text(),
  })
  .superRefine((w, ctx) => {
    if (w.endDate && w.endDate < w.startDate)
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "El retiro no puede ser anterior al ingreso",
      });
  });
export type WorkerInput = z.input<typeof workerSchema>;
export type WorkerData = z.output<typeof workerSchema>;

export const isActive = (w: { endDate: string | null }, today: string) =>
  !w.endDate || w.endDate >= today;

/** Encabezados de la plantilla de carga masiva (en español) → campo. */
export const IMPORT_HEADERS: Record<string, keyof WorkerInput> = {
  vinculacion: "kind",
  tipo_documento: "idType",
  documento: "idNumber",
  nombre: "fullName",
  correo: "email",
  telefono: "phone",
  cargo: "position",
  area: "area",
  sede: "workCenterId",
  tipo_contrato: "contractType",
  fecha_ingreso: "startDate",
  fecha_retiro: "endDate",
  eps: "eps",
  afp: "afp",
  arl: "arl",
  clase_riesgo_arl: "arlRiskClass",
  ccf: "ccf",
  empresa_contratista: "contractorCompany",
};
export const IMPORT_TEMPLATE = Object.keys(IMPORT_HEADERS).join(",");

const KIND_ALIAS: Record<string, string> = {
  trabajador: "employee",
  empleado: "employee",
  aprendiz: "apprentice",
  contratista: "contractor",
  employee: "employee",
  apprentice: "apprentice",
  contractor: "contractor",
};
const ID_ALIAS: Record<string, string> = {
  cc: "13",
  ce: "22",
  pasaporte: "41",
  ti: "12",
  nit: "31",
  pep: "42",
};
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export type ImportReport = {
  valid: { row: number; data: WorkerData }[];
  errors: { row: number; message: string }[];
};

/**
 * Filas de un CSV (primera fila = encabezados) → trabajadores válidos y errores por fila. La sede se resuelve por
 * nombre; los alias de vinculación y tipo de documento son los usados comúnmente (CC, CE, "empleado"…).
 */
export function parseWorkerRows(
  rows: string[][],
  centersByName: Map<string, string>,
): ImportReport {
  const report: ImportReport = { valid: [], errors: [] };
  if (rows.length < 2) {
    report.errors.push({ row: 1, message: "El archivo no tiene filas de datos" });
    return report;
  }
  const headers = rows[0].map((h) => norm(h).replaceAll(" ", "_"));
  const unknown = headers.filter((h) => !(h in IMPORT_HEADERS));
  if (unknown.length) {
    report.errors.push({ row: 1, message: `Columnas no reconocidas: ${unknown.join(", ")}` });
    return report;
  }
  const required = ["vinculacion", "tipo_documento", "documento", "nombre", "fecha_ingreso"];
  const missing = required.filter((h) => !headers.includes(h));
  if (missing.length) {
    report.errors.push({ row: 1, message: `Faltan columnas obligatorias: ${missing.join(", ")}` });
    return report;
  }
  const seen = new Map<string, number>();
  rows.slice(1).forEach((cells, i) => {
    const row = i + 2;
    const raw: Record<string, string> = {};
    headers.forEach((h, c) => (raw[IMPORT_HEADERS[h]] = (cells[c] ?? "").trim()));
    raw.kind = KIND_ALIAS[norm(raw.kind)] ?? raw.kind;
    raw.idType = ID_ALIAS[norm(raw.idType)] ?? raw.idType;
    if (raw.workCenterId) {
      const id = centersByName.get(norm(raw.workCenterId));
      if (!id)
        return report.errors.push({ row, message: `Sede no encontrada: ${raw.workCenterId}` });
      raw.workCenterId = id;
    }
    const parsed = workerSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return report.errors.push({
        row,
        message: `${issue.path.join(".") || "fila"}: ${issue.message}`,
      });
    }
    const dup = seen.get(parsed.data.idNumber);
    if (dup)
      return report.errors.push({ row, message: `Documento repetido en el archivo (fila ${dup})` });
    seen.set(parsed.data.idNumber, row);
    report.valid.push({ row, data: parsed.data });
  });
  return report;
}

/** Periodo AAAA-MM anterior al de `today` (los aportes de seguridad social se pagan mes vencido). */
export function previousPeriod(today: string): string {
  const [y, m] = today.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

export type SsState = "al_dia" | "pendiente" | "vencida";
/**
 * Estado de la verificación de seguridad social de un contratista: se verifica mensualmente el pago del mes anterior.
 * `deadlineDay` es el día del mes hasta el cual aún es "pendiente"; después, "vencida".
 * TODO-NORMA: validar el día límite de verificación (parámetro `contratistas.ss_verificacion_dia`).
 */
export function ssState(
  checks: { period: string; paid: boolean }[],
  today: string,
  deadlineDay: number,
): SsState {
  const due = previousPeriod(today);
  if (checks.some((c) => c.period === due && c.paid)) return "al_dia";
  return Number(today.slice(8, 10)) > deadlineDay ? "vencida" : "pendiente";
}
