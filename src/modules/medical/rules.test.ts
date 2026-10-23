import { describe, expect, it } from "vitest";
import {
  absenceSchema,
  absenteeismRate,
  adaptationDue,
  assertAllowedExamText,
  blockedExamText,
  daysWithin,
  periodicState,
  resultSchema,
  returnEvaluationsNeeded,
} from "./rules";

describe("bloqueo de pruebas discriminatorias", () => {
  it.each([
    "Prueba de embarazo",
    "examen VIH",
    "serología",
    "Test de gestación",
    "descartar SIDA",
    "Inmunodeficiencia humana",
  ])("bloquea «%s»", (t) => expect(blockedExamText(t)).toBe(true));
  it.each(["Audiometría", "Optometría", "Examen osteomuscular", "Espirometría"])(
    "permite «%s»",
    (t) => expect(blockedExamText(t)).toBe(false),
  );
  it("assertAllowedExamText lanza con mensaje claro y acepta vacíos", () => {
    expect(() => assertAllowedExamText("Audiometría", "prueba de embarazo")).toThrow(
      /discriminatorio/,
    );
    expect(() => assertAllowedExamText(null, undefined, "Audiometría")).not.toThrow();
  });
});

describe("plazos y estados", () => {
  it("adaptación del puesto a 20 días", () =>
    expect(adaptationDue("2026-10-20", 20)).toBe("2026-11-09"));
  it("estado de la periódica", () => {
    expect(periodicState(null, "2026-10-23", 30)).toBe("sin_programar");
    expect(periodicState("2026-10-01", "2026-10-23", 30)).toBe("vencida");
    expect(periodicState("2026-11-10", "2026-10-23", 30)).toBe("por_vencer");
    expect(periodicState("2027-03-01", "2026-10-23", 30)).toBe("al_dia");
  });
  it("resultado con restricciones exige el detalle", () => {
    const base = {
      evaluationId: "00000000-0000-7000-8000-000000000001",
      performedDate: "2026-10-01",
      concept: "apto_restricciones",
    };
    expect(resultSchema.safeParse(base).success).toBe(false);
    expect(resultSchema.safeParse({ ...base, recommendations: "Pausas activas" }).success).toBe(
      true,
    );
    expect(resultSchema.parse({ ...base, concept: "apto", costPesos: "" }).costPesos).toBeNull();
  });
  it("ausencia: fin no anterior al inicio", () => {
    const base = {
      workerId: "00000000-0000-7000-8000-000000000001",
      cause: "license",
      startDate: "2026-10-10",
    };
    expect(absenceSchema.safeParse({ ...base, endDate: "2026-10-01" }).success).toBe(false);
    expect(absenceSchema.parse({ ...base, endDate: "" }).endDate).toBeNull();
  });
});

describe("retorno laboral y ausentismo", () => {
  const abs = (over: object) => ({
    id: "a",
    workerId: "w",
    cause: "license",
    startDate: "2026-01-01",
    endDate: "2026-04-15",
    ...over,
  });
  it("causa no médica de más de 90 días sin evaluación de retorno", () => {
    expect(returnEvaluationsNeeded([abs({})], [], 90, "2026-10-23")).toHaveLength(1);
    expect(
      returnEvaluationsNeeded([abs({ endDate: "2026-03-31" })], [], 90, "2026-10-23"),
    ).toHaveLength(0); // 90 días exactos no exceden
    expect(
      returnEvaluationsNeeded([abs({ endDate: "2026-04-01" })], [], 90, "2026-10-23"),
    ).toHaveLength(1); // 91
    expect(
      returnEvaluationsNeeded([abs({ cause: "common_illness" })], [], 90, "2026-10-23"),
    ).toHaveLength(0);
    expect(
      returnEvaluationsNeeded(
        [abs({})],
        [{ workerId: "w", performedDate: "2026-04-20" }],
        90,
        "2026-10-23",
      ),
    ).toHaveLength(0);
    expect(
      returnEvaluationsNeeded(
        [abs({ endDate: null, startDate: "2026-08-01" })],
        [],
        90,
        "2026-10-23",
      ),
    ).toHaveLength(0); // en curso, 84 días
    expect(
      returnEvaluationsNeeded(
        [abs({ endDate: null, startDate: "2026-06-01" })],
        [],
        90,
        "2026-10-23",
      ),
    ).toHaveLength(1);
  });
  it("tasa de ausentismo y recorte por periodo", () => {
    expect(absenteeismRate(30, 100, 30)).toBe(1);
    expect(absenteeismRate(5, 0, 30)).toBe(0);
    expect(
      daysWithin({ startDate: "2026-09-25", endDate: "2026-10-05" }, "2026-10-01", "2026-10-31"),
    ).toBe(5);
    expect(daysWithin({ startDate: "2026-10-20", endDate: null }, "2026-10-01", "2026-10-31")).toBe(
      12,
    );
    expect(
      daysWithin({ startDate: "2026-08-01", endDate: "2026-08-10" }, "2026-10-01", "2026-10-31"),
    ).toBe(0);
  });
});
