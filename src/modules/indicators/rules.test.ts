import { describe, expect, it } from "vitest";
import {
  measure,
  periodRange,
  recentPeriods,
  statusOf,
  trendDirection,
  value,
  type IndicatorData,
} from "./rules";

describe("periodos", () => {
  it.each([
    ["mensual", "2026-02-10", "2026-02-01", "2026-02-28"],
    ["trimestral", "2026-05-03", "2026-04-01", "2026-06-30"],
    ["semestral", "2026-09-30", "2026-07-01", "2026-12-31"],
    ["anual", "2026-03-01", "2026-01-01", "2026-12-31"],
  ] as const)("%s que contiene %s", (p, ref, from, to) =>
    expect(periodRange(p, ref)).toEqual({ from, to }),
  );
  it("los periodos recientes cruzan el cambio de año, del más antiguo al más reciente", () => {
    expect(recentPeriods("mensual", "2026-02-15", 3).map((p) => p.from)).toEqual([
      "2025-12-01",
      "2026-01-01",
      "2026-02-01",
    ]);
    expect(recentPeriods("trimestral", "2026-02-15", 2).map((p) => p.from)).toEqual([
      "2025-10-01",
      "2026-01-01",
    ]);
  });
});

const data: IndicatorData = {
  accidents: [
    { occurredOn: "2026-03-05", severity: "minor" },
    { occurredOn: "2026-03-20", severity: "fatal" },
    { occurredOn: "2026-02-10", severity: "minor" },
  ],
  absences: [
    { cause: "work_accident", startDate: "2026-03-05", endDate: "2026-03-14" }, // 10 días
    { cause: "common_illness", startDate: "2026-02-25", endDate: "2026-03-03" }, // 3 días en marzo
    { cause: "license", startDate: "2026-03-01", endDate: "2026-03-31" }, // no médica
  ],
  diseases: [
    { detectedOn: "2025-06-01", qualification: "occupational", isNew: true },
    { detectedOn: "2026-03-10", qualification: "occupational", isNew: true },
    { detectedOn: "2026-03-11", qualification: "common", isNew: true },
    { detectedOn: "2026-03-12", qualification: "pending", isNew: true },
  ],
  workers: [
    ...Array.from({ length: 20 }, () => ({
      kind: "employee",
      startDate: "2024-01-01",
      endDate: null,
    })),
    { kind: "contractor", startDate: "2024-01-01", endDate: null },
    { kind: "employee", startDate: "2024-01-01", endDate: "2026-01-31" },
  ],
};
const m = (code: string) =>
  measure(code, data, "2026-03-01", "2026-03-31", { chargedDaysFatal: 6000 });

describe("fórmulas de los indicadores (Res. 0312, art. 30)", () => {
  it("frecuencia: accidentes del mes sobre trabajadores (sin contratistas ni retirados)", () => {
    expect(m("frecuencia_accidentalidad")).toEqual({ numerator: 2, denominator: 20 });
    expect(value(m("frecuencia_accidentalidad"), 100)).toBe(10);
  });
  it("severidad: días de incapacidad por AT dentro del mes + días cargados por muerte", () => {
    expect(m("severidad_accidentalidad")).toEqual({ numerator: 10 + 6000, denominator: 20 });
  });
  it("mortalidad: mortales sobre total de accidentes del periodo", () => {
    expect(m("mortalidad_accidentes")).toEqual({ numerator: 1, denominator: 2 });
  });
  it("prevalencia cuenta casos laborales calificados acumulados; incidencia solo los nuevos del periodo", () => {
    expect(m("prevalencia_enfermedad_laboral")).toEqual({ numerator: 2, denominator: 20 });
    expect(m("incidencia_enfermedad_laboral")).toEqual({ numerator: 1, denominator: 20 });
  });
  it("ausentismo: solo causas médicas, sobre trabajadores × días del mes", () => {
    expect(m("ausentismo_causa_medica")).toEqual({ numerator: 10 + 3, denominator: 20 * 31 });
  });
  it("código sin cálculo automático devuelve null", () => {
    expect(m("indicador_propio")).toBeNull();
    expect(value(null, 100)).toBeNull();
  });
  it("denominador cero (sin trabajadores o sin accidentes) no inventa un valor", () => {
    expect(value({ numerator: 0, denominator: 0 }, 100)).toBeNull();
    expect(value({ numerator: 1, denominator: 3 }, 100)).toBe(33.33);
  });
});

describe("meta y tendencia", () => {
  it("menor es mejor: cumple si no supera la meta", () => {
    expect(statusOf(2, 2)).toBe("cumple");
    expect(statusOf(2.01, 2)).toBe("no_cumple");
    expect(statusOf(1, null)).toBe("sin_meta");
    expect(statusOf(null, 2)).toBe("sin_datos");
  });
  it("la tendencia compara los dos últimos periodos con dato", () => {
    expect(trendDirection([1, null, 3, 2])).toBe("baja");
    expect(trendDirection([2, 2])).toBe("igual");
    expect(trendDirection([null, 1])).toBeNull();
  });
});
