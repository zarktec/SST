import { z } from "zod";
import { expiryState, type ExpiryState } from "@/modules/emergencies/rules";

export const VEHICLE_KINDS = [
  { value: "car", label: "Automóvil / camioneta" },
  { value: "motorcycle", label: "Motocicleta" },
  { value: "truck", label: "Camión" },
  { value: "bus", label: "Bus / buseta" },
  { value: "other", label: "Otro" },
] as const;
export const OWNERSHIP = [
  { value: "own", label: "Propio" },
  { value: "leased", label: "Arrendado" },
  { value: "contractor", label: "De contratista" },
  { value: "employee", label: "Del trabajador" },
] as const;
export const LICENSE_CATEGORIES = ["A1", "A2", "B1", "B2", "B3", "C1", "C2", "C3"] as const;

/**
 * Lista preoperacional genérica y PROVISIONAL (TODO-NORMA): cada empresa debe ajustarla a su tipo de vehículo con su responsable
 * del PESV. `critical`: una falla impide usar el vehículo hasta corregirla.
 */
export const PREOP_ITEMS: { item: string; critical: boolean }[] = [
  { item: "Frenos", critical: true },
  { item: "Dirección", critical: true },
  { item: "Llantas (estado y presión)", critical: true },
  { item: "Luces delanteras, traseras y direccionales", critical: true },
  { item: "Cinturones de seguridad / casco", critical: true },
  { item: "Espejos y vidrios", critical: false },
  { item: "Niveles de aceite y refrigerante", critical: false },
  { item: "Extintor y botiquín", critical: false },
  { item: "Documentos del vehículo y del conductor", critical: false },
];

export type VehicleDocs = { soat: ExpiryState; rtm: ExpiryState; ok: boolean };
/** Documentos al día: SOAT vigente y revisión técnico-mecánica vigente (o sin fecha por exención). */
export function vehicleDocs(
  v: { soatExpiresOn: string | null; rtmExpiresOn: string | null },
  today: string,
  warnDays: number,
): VehicleDocs {
  const soat = expiryState(v.soatExpiresOn, today, warnDays);
  const rtm = expiryState(v.rtmExpiresOn, today, warnDays);
  return { soat, rtm, ok: soat !== "vencido" && soat !== "sin_fecha" && rtm !== "vencido" };
}

export type PesvStats = {
  vehicles: number;
  vehiclesDocsOk: number;
  drivers: number;
  driversLicenseOk: number;
  preopVehiclesLast30: number;
  crashes: number;
  injured: number;
  fatalities: number;
  crashesPerVehicle: number | null;
};
/**
 * Datos para el reporte anual de autogestión del PESV (Resolución 40595 de 2022). Las fórmulas oficiales de los indicadores están
 * pendientes de validación (TODO-NORMA): aquí se entregan los conteos base del año.
 */
export function pesvStats(
  d: {
    vehicles: { id: string; soatExpiresOn: string | null; rtmExpiresOn: string | null }[];
    drivers: { licenseExpiresOn: string }[];
    preops: { vehicleId: string; performedOn: string }[];
    crashes: { occurredOn: string; injured: number; fatalities: number }[];
  },
  year: number,
  today: string,
): PesvStats {
  const crashes = d.crashes.filter((c) => c.occurredOn.startsWith(String(year)));
  const since = new Date(Date.parse(today) - 30 * 86_400_000).toISOString().slice(0, 10);
  const preopIds = new Set(d.preops.filter((p) => p.performedOn >= since).map((p) => p.vehicleId));
  return {
    vehicles: d.vehicles.length,
    vehiclesDocsOk: d.vehicles.filter((v) => vehicleDocs(v, today, 0).ok).length,
    drivers: d.drivers.length,
    driversLicenseOk: d.drivers.filter((x) => x.licenseExpiresOn >= today).length,
    preopVehiclesLast30: d.vehicles.filter((v) => preopIds.has(v.id)).length,
    crashes: crashes.length,
    injured: crashes.reduce((s, c) => s + c.injured, 0),
    fatalities: crashes.reduce((s, c) => s + c.fatalities, 0),
    crashesPerVehicle: d.vehicles.length
      ? Math.round((crashes.length / d.vehicles.length) * 100) / 100
      : null,
  };
}

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (AAAA-MM-DD)");
const optDate = z
  .union([z.literal(""), ymd])
  .optional()
  .transform((v) => v || null);
const optText = (max = 300) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
const optInt = z
  .union([z.literal(""), z.coerce.number().int().min(0).max(10_000_000)])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

export const vehicleSchema = z.object({
  plate: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{5,7}$/, "Placa inválida (5 a 7 letras o números)"),
  kind: z.enum(["car", "motorcycle", "truck", "bus", "other"]),
  ownership: z.enum(["own", "leased", "contractor", "employee"]).default("own"),
  description: optText(200),
  soatExpiresOn: optDate,
  rtmExpiresOn: optDate,
});
export const driverSchema = z.object({
  workerId: z.uuid("Selecciona la persona"),
  licenseCategory: z.enum(LICENSE_CATEGORIES),
  licenseExpiresOn: ymd,
});
export const preopSchema = z.object({
  vehicleId: z.uuid("Selecciona el vehículo"),
  odometer: optInt,
  notes: optText(500),
});
export const crashSchema = z.object({
  vehicleId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => v || null),
  driverName: z.string().trim().min(2, "Indica el conductor").max(120),
  date: ymd,
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Hora inválida")
    .default("00:00"),
  place: z.string().trim().min(3, "Indica el lugar").max(200),
  description: z.string().trim().min(10, "Describe lo ocurrido").max(3000),
  injured: z.coerce.number().int().min(0).max(1000).default(0),
  fatalities: z.coerce.number().int().min(0).max(1000).default(0),
  atFault: z.enum(["yes", "no", "unknown"]).default("unknown"),
});
