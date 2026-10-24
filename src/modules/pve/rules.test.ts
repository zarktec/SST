import { describe, expect, it } from "vitest";
import { followUpState, psychosocialNextDue, psychosocialSchema, psychosocialState } from "./rules";

const months = { high: 12, mediumLow: 24 };

describe("riesgo psicosocial (Res. 2646 de 2008)", () => {
  it("periodicidad: anual si el riesgo es alto o muy alto; cada 2 años si es medio, bajo o nulo", () => {
    expect(psychosocialNextDue("2026-03-15", "high", months)).toBe("2027-03-15");
    expect(psychosocialNextDue("2026-03-15", "very_high", months)).toBe("2027-03-15");
    expect(psychosocialNextDue("2026-03-15", "medium", months)).toBe("2028-03-15");
    expect(psychosocialNextDue("2026-03-15", "low", months)).toBe("2028-03-15");
    expect(psychosocialNextDue("2026-03-15", "none", months)).toBe("2028-03-15");
  });
  it("estado de la próxima aplicación", () => {
    expect(psychosocialState(null, "2026-06-01", 60)).toBe("sin_aplicar");
    expect(psychosocialState("2026-05-31", "2026-06-01", 60)).toBe("vencida");
    expect(psychosocialState("2026-07-15", "2026-06-01", 60)).toBe("por_vencer");
    expect(psychosocialState("2026-09-01", "2026-06-01", 60)).toBe("al_dia");
  });
  it("seguimiento de casos y plan de intervención por líneas", () => {
    expect(followUpState(null, "2026-06-01")).toBe("sin_fecha");
    expect(followUpState("2026-05-31", "2026-06-01")).toBe("vencido");
    expect(followUpState("2026-06-01", "2026-06-01")).toBe("al_dia");
    const r = psychosocialSchema.parse({
      appliedOn: "2026-03-01",
      psychologistName: "Dra. Ana Ruiz",
      licenseNumber: "SST-12345",
      riskLevel: "high",
      interventions: "Capacitar en manejo del estrés\n\nx\nRevisar cargas de trabajo",
    });
    expect(r.interventions).toEqual([
      "Capacitar en manejo del estrés",
      "Revisar cargas de trabajo",
    ]);
    expect(
      psychosocialSchema.safeParse({ appliedOn: "2026-03-01", riskLevel: "high" }).success,
    ).toBe(false);
  });
});
