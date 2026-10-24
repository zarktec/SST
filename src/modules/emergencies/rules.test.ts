import { describe, expect, it } from "vitest";
import {
  drillResultSchema,
  drillStatus,
  expiryState,
  inspectionState,
  nextPlanReview,
} from "./rules";

describe("emergencias", () => {
  it("vencimiento de equipos con anticipación", () => {
    expect(expiryState(null, "2026-06-01", 30)).toBe("sin_fecha");
    expect(expiryState("2026-05-31", "2026-06-01", 30)).toBe("vencido");
    expect(expiryState("2026-06-01", "2026-06-01", 30)).toBe("por_vencer");
    expect(expiryState("2026-07-01", "2026-06-01", 30)).toBe("por_vencer");
    expect(expiryState("2026-07-02", "2026-06-01", 30)).toBe("vigente");
  });
  it("inspección periódica", () => {
    expect(inspectionState(null, "2026-06-01", 30)).toBe("sin_inspeccion");
    expect(inspectionState("2026-05-02", "2026-06-01", 30)).toBe("al_dia");
    expect(inspectionState("2026-05-01", "2026-06-01", 30)).toBe("vencida");
    expect(inspectionState("2026-04-30", "2026-06-01", 30)).toBe("vencida");
  });
  it("simulacro anual: cuenta los realizados del año", () => {
    const d = [
      { status: "done", plannedOn: "2025-11-01", performedOn: "2025-11-02" },
      { status: "planned", plannedOn: "2026-09-01", performedOn: null },
      { status: "cancelled", plannedOn: "2026-03-01", performedOn: null },
    ];
    expect(drillStatus(d, 2026, 1)).toEqual({ done: 0, planned: 1, required: 1, ok: false });
    expect(drillStatus(d, 2025, 1).ok).toBe(true);
  });
  it("próxima revisión del plan", () =>
    expect(nextPlanReview("2026-01-31", 12)).toBe("2027-01-31"));
  it("las mejoras del simulacro se separan por línea y exigen evaluación", () => {
    const r = drillResultSchema.parse({
      performedOn: "2026-05-01",
      evaluation: "Evacuación en 4 minutos, hubo congestión",
      improvements: "Ampliar la salida norte\n\nx\nSeñalizar la ruta B",
    });
    expect(r.improvements).toEqual(["Ampliar la salida norte", "Señalizar la ruta B"]);
    expect(
      drillResultSchema.safeParse({ performedOn: "2026-05-01", evaluation: "corto" }).success,
    ).toBe(false);
  });
});
