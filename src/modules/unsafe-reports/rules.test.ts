import { describe, expect, it } from "vitest";
import { reportSchema, reviewSchema } from "./rules";

describe("reporte de condiciones y actos inseguros", () => {
  it("solo la descripción es obligatoria", () => {
    const r = reportSchema.parse({ kind: "condition", description: "Cable pelado en el pasillo" });
    expect(r).toMatchObject({ place: null, severity: "medium", anonymous: false, latitude: null });
  });
  it("interpreta el checkbox anónimo y las coordenadas del formulario", () => {
    const r = reportSchema.parse({
      kind: "act",
      description: "Sin casco en la obra",
      anonymous: "on",
      latitude: "4.65",
      longitude: "-74.05",
    });
    expect(r.anonymous).toBe(true);
    expect(r.latitude).toBe(4.65);
  });
  it("rechaza descripción corta y coordenadas fuera de rango", () => {
    expect(reportSchema.safeParse({ kind: "act", description: "hey" }).success).toBe(false);
    expect(
      reportSchema.safeParse({ kind: "act", description: "Sin casco", latitude: "99" }).success,
    ).toBe(false);
  });
  it("descartar exige motivo; crear acción exige responsable y fecha", () => {
    expect(reviewSchema.safeParse({ decision: "dismiss", note: "" }).success).toBe(false);
    expect(
      reviewSchema.safeParse({
        decision: "action",
        title: "Cambiar el cable",
        responsibleName: "Ana",
        dueDate: "2030-01-01",
      }).success,
    ).toBe(true);
    expect(reviewSchema.safeParse({ decision: "action", title: "Cambiar el cable" }).success).toBe(
      false,
    );
  });
});
