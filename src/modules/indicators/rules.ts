import { addMonths, daysInclusive } from "@/lib/dates";
import { daysWithin, isMedicalCause } from "@/modules/medical/rules";

export type Periodicity = "mensual" | "trimestral" | "semestral" | "anual";
const MONTHS: Record<Periodicity, number> = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Periodo calendario (mes, trimestre, semestre o año) que contiene `ref`. */
export function periodRange(periodicity: Periodicity, ref: string): { from: string; to: string } {
  const y = Number(ref.slice(0, 4));
  const m = Number(ref.slice(5, 7));
  const span = MONTHS[periodicity];
  const startMonth = Math.floor((m - 1) / span) * span + 1;
  const endMonth = startMonth + span - 1;
  return {
    from: `${y}-${pad(startMonth)}-01`,
    to: `${y}-${pad(endMonth)}-${pad(lastDay(y, endMonth))}`,
  };
}

/** Los `count` periodos más recientes que terminan en el periodo de `ref`, del más antiguo al más reciente. */
export function recentPeriods(periodicity: Periodicity, ref: string, count: number) {
  const cur = periodRange(periodicity, ref);
  const out = [cur];
  for (let i = 1; i < count; i++)
    out.unshift(periodRange(periodicity, addMonths(out[0].from, -MONTHS[periodicity])));
  return out;
}
export const periodKey = (p: Periodicity, from: string) => `${p}:${from}`;
export const TREND_LENGTH: Record<Periodicity, number> = {
  mensual: 6,
  trimestral: 4,
  semestral: 4,
  anual: 3,
};

export type IndicatorData = {
  accidents: { occurredOn: string; severity: string }[];
  absences: { cause: string; startDate: string; endDate: string | null }[];
  diseases: { detectedOn: string; qualification: string; isNew: boolean }[];
  workers: { kind: string; startDate: string; endDate: string | null }[];
};

/** Trabajadores vinculados en algún momento del periodo (sin contratistas, que no cuentan para estos indicadores). */
export const workersIn = (d: IndicatorData, from: string, to: string) =>
  d.workers.filter(
    (w) => w.kind !== "contractor" && w.startDate <= to && (!w.endDate || w.endDate >= from),
  ).length;

export const CALCULABLE = [
  "frecuencia_accidentalidad",
  "severidad_accidentalidad",
  "mortalidad_accidentes",
  "prevalencia_enfermedad_laboral",
  "incidencia_enfermedad_laboral",
  "ausentismo_causa_medica",
] as const;

export type Measure = { numerator: number; denominator: number };

/**
 * Numerador y denominador de cada indicador del catálogo para el periodo [from, to] (Resolución 0312 de 2019, art. 30).
 * `chargedDaysFatal`: días cargados por accidente mortal que se suman a la severidad (TODO-NORMA: parametrizable).
 * Devuelve null si el código no tiene cálculo automático (indicador agregado a mano al catálogo).
 */
export function measure(
  code: string,
  d: IndicatorData,
  from: string,
  to: string,
  opts: { chargedDaysFatal: number },
): Measure | null {
  const accidents = d.accidents.filter((a) => a.occurredOn >= from && a.occurredOn <= to);
  const workers = workersIn(d, from, to);
  switch (code) {
    case "frecuencia_accidentalidad":
      return { numerator: accidents.length, denominator: workers };
    case "severidad_accidentalidad": {
      const lost = d.absences
        .filter((a) => a.cause === "work_accident")
        .reduce((s, a) => s + daysWithin(a, from, to), 0);
      const charged =
        accidents.filter((a) => a.severity === "fatal").length * opts.chargedDaysFatal;
      return { numerator: lost + charged, denominator: workers };
    }
    case "mortalidad_accidentes":
      return {
        numerator: accidents.filter((a) => a.severity === "fatal").length,
        denominator: accidents.length,
      };
    case "prevalencia_enfermedad_laboral":
      return {
        numerator: d.diseases.filter(
          (x) => x.qualification === "occupational" && x.detectedOn <= to,
        ).length,
        denominator: workers,
      };
    case "incidencia_enfermedad_laboral":
      return {
        numerator: d.diseases.filter(
          (x) =>
            x.qualification === "occupational" &&
            x.isNew &&
            x.detectedOn >= from &&
            x.detectedOn <= to,
        ).length,
        denominator: workers,
      };
    case "ausentismo_causa_medica": {
      const lost = d.absences
        .filter((a) => isMedicalCause(a.cause))
        .reduce((s, a) => s + daysWithin(a, from, to), 0);
      return { numerator: lost, denominator: workers * daysInclusive(from, to) };
    }
    default:
      return null;
  }
}

/** Valor del indicador = numerador / denominador × factor, con 2 decimales; null si el denominador es 0. */
export function value(m: Measure | null, factor: number): number | null {
  if (!m || m.denominator <= 0) return null;
  return Math.round((m.numerator / m.denominator) * factor * 100) / 100;
}

export type Status = "cumple" | "no_cumple" | "sin_meta" | "sin_datos";
/** Todos los indicadores de resultado del catálogo son "menor es mejor": cumple si el valor no supera la meta. */
export function statusOf(v: number | null, target: number | null): Status {
  if (v === null) return "sin_datos";
  if (target === null) return "sin_meta";
  return v <= target ? "cumple" : "no_cumple";
}

export function trendDirection(values: (number | null)[]): "sube" | "baja" | "igual" | null {
  const v = values.filter((x): x is number => x !== null);
  if (v.length < 2) return null;
  const [a, b] = [v[v.length - 2], v[v.length - 1]];
  return b > a ? "sube" : b < a ? "baja" : "igual";
}
