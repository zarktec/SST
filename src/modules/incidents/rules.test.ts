import { describe, expect, it } from "vitest";
import {
  analysisErrors,
  closeBlockers,
  diseaseSchema,
  incidentSchema,
  investigationDeadline,
  parseWhys,
  reportDeadline,
  reportState,
  teamErrors,
} from "./rules";

const cal = { holidays: new Set(["2026-10-12"]) }; // lunes festivo

describe("plazo de reporte a la ARL/EPS (2 días hábiles)", () => {
  it("cuenta días hábiles desde que se conoce y salta festivos y fin de semana", () => {
    expect(reportDeadline(new Date("2026-10-07T15:00:00Z"), 2, cal)).toBe("2026-10-09"); // mié → vie
    expect(reportDeadline(new Date("2026-10-09T15:00:00Z"), 2, cal)).toBe("2026-10-14"); // vie → mar (lunes festivo)
  });
  it("usa la fecha de Colombia (no UTC)", () => {
    expect(reportDeadline(new Date("2026-10-08T03:00:00Z"), 2, cal)).toBe("2026-10-09"); // 22:00 del miércoles 7 en Bogotá
  });
  it("contador: en plazo, vence hoy, vencido y reportado", () => {
    expect(reportState("2026-10-09", null, "2026-10-07", cal)).toEqual({
      state: "en_plazo",
      businessDaysLeft: 2,
    });
    expect(reportState("2026-10-09", null, "2026-10-09", cal)).toEqual({
      state: "vence_hoy",
      businessDaysLeft: 0,
    });
    expect(reportState("2026-10-09", null, "2026-10-13", cal).state).toBe("vencido");
    expect(reportState("2026-10-09", "2026-10-08", "2026-10-30", cal).state).toBe("reportado");
  });
  it("investigación a 15 días", () =>
    expect(investigationDeadline("2026-10-01", 15)).toBe("2026-10-16"));
});

describe("investigación", () => {
  const full = [
    { name: "A", role: "copasst" as const },
    { name: "B", role: "sst" as const },
    { name: "C", role: "boss" as const },
  ];
  it("equipo mínimo y profesional con licencia si es grave", () => {
    expect(teamErrors(full, false)).toEqual([]);
    expect(teamErrors(full, true)).toEqual([
      "Por la gravedad, el equipo debe incluir un profesional con licencia en SST",
    ]);
    expect(teamErrors([], false)).toHaveLength(3);
    expect(teamErrors([...full, { name: "D", role: "licensed" }], true)).toEqual([]);
  });
  it("5 porqués y árbol de causas", () => {
    expect(parseWhys("1. Se cayó\n2) Piso mojado\n\nSin señal")).toEqual([
      "Se cayó",
      "Piso mojado",
      "Sin señal",
    ]);
    expect(analysisErrors("five_whys", ["a", "b"])).toHaveLength(1);
    expect(analysisErrors("five_whys", ["a", "b", "c"])).toEqual([]);
    expect(analysisErrors("cause_tree", [{ text: "x" }, { text: "y" }])).toHaveLength(1);
    expect(analysisErrors("cause_tree", [{ text: "x" }, { text: "y" }, { text: "z" }])).toEqual([]);
  });
  it("requisitos de cierre incluyen acción y remisión a la ARL si es grave", () => {
    const base = {
      team: full,
      method: "five_whys",
      analysis: ["a", "b", "c"],
      immediateCauses: "Piso mojado",
      basicCauses: "Sin procedimiento",
      actionCount: 1,
      severe: false,
      remittedArlAt: null,
    };
    expect(closeBlockers(base)).toEqual([]);
    expect(closeBlockers({ ...base, actionCount: 0, immediateCauses: " " })).toHaveLength(2);
    expect(
      closeBlockers({ ...base, severe: true, team: [...full, { name: "L", role: "licensed" }] }),
    ).toEqual(["Un evento grave o mortal debe remitirse a la ARL"]);
  });
});

describe("validaciones", () => {
  const base = {
    kind: "accident",
    occurredDate: "2026-10-01",
    place: "Bodega",
    description: "Se resbaló en el pasillo mojado",
    severity: "minor",
    affectedName: "Visitante",
  };
  it("accidente exige lesión y afectado", () => {
    expect(incidentSchema.safeParse(base).success).toBe(true);
    expect(incidentSchema.safeParse({ ...base, severity: "none" }).success).toBe(false);
    expect(incidentSchema.safeParse({ ...base, affectedName: "" }).success).toBe(false);
    expect(incidentSchema.safeParse({ ...base, kind: "incident", severity: "none" }).success).toBe(
      true,
    );
  });
  it("enfermedad laboral", () => {
    expect(
      diseaseSchema.safeParse({
        workerId: "00000000-0000-7000-8000-000000000001",
        diagnosis: "Hipoacusia",
        detectedOn: "2026-09-01",
        isNew: "on",
      }).success,
    ).toBe(true);
  });
});
