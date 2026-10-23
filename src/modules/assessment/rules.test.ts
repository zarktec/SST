import { describe, expect, it } from "vitest";
import {
  assessmentReminder,
  closeBlockers,
  ratingFor,
  scoreAssessment,
  trend,
  type RatingRange,
} from "./rules";

const RANGES: RatingRange[] = [
  {
    level: "critico",
    label: "Crítico",
    minPct: null,
    maxPct: 60,
    minInclusive: true,
    maxInclusive: false,
    actions: [],
  },
  {
    level: "moderado",
    label: "Moderado",
    minPct: 60,
    maxPct: 85,
    minInclusive: true,
    maxInclusive: true,
    actions: [],
  },
  {
    level: "aceptable",
    label: "Aceptable",
    minPct: 85,
    maxPct: null,
    minInclusive: false,
    maxInclusive: true,
    actions: [],
  },
];

describe("puntaje", () => {
  it("suma lo que cumple sobre el total; no aplica cuenta completo", () => {
    const r = scoreAssessment([
      { status: "cumple", weight: 2 },
      { status: "no_cumple", weight: 3 },
      { status: "no_aplica", weight: 1 },
      { status: "pending", weight: 4 },
    ]);
    expect(r).toEqual({ total: 10, earned: 3, pct: 30 });
  });
  it("no aplica puede excluirse del puntaje (parametrizable)", () => {
    expect(
      scoreAssessment(
        [
          { status: "no_aplica", weight: 5 },
          { status: "cumple", weight: 5 },
        ],
        { noApplyCountsAsFull: false },
      ).pct,
    ).toBe(50);
  });
  it("sin ítems el puntaje es 0 y redondea a 2 decimales", () => {
    expect(scoreAssessment([]).pct).toBe(0);
    expect(
      scoreAssessment([
        { status: "cumple", weight: 1 },
        { status: "no_cumple", weight: 2 },
      ]).pct,
    ).toBe(33.33);
  });
});

describe("rangos de calificación", () => {
  it.each([
    [59.99, "critico"],
    [60, "moderado"],
    [85, "moderado"],
    [85.01, "aceptable"],
    [100, "aceptable"],
    [0, "critico"],
  ])("%f %% → %s", (pct, level) => expect(ratingFor(pct, RANGES)?.level).toBe(level));
});

describe("cierre y seguimiento", () => {
  it("bloquea con pendientes y no aplica sin justificación", () => {
    const b = closeBlockers([
      { itemCode: "1.1", status: "pending", justification: null },
      { itemCode: "1.2", status: "no_aplica", justification: " " },
      { itemCode: "1.3", status: "no_aplica", justification: "No hay obras" },
    ]);
    expect(b).toEqual([
      "Faltan 1 ítems por calificar",
      "El ítem 1.2 no aplica y requiere justificación",
    ]);
  });
  it("tendencia con variación", () => {
    expect(
      trend([
        { year: 2026, pct: 80, level: null },
        { year: 2025, pct: 70.5, level: null },
      ]),
    ).toEqual([
      { year: 2025, pct: 70.5, delta: null },
      { year: 2026, pct: 80, delta: 9.5 },
    ]);
  });
  it("recordatorios: aplicar desde diciembre; registrar hasta el plazo", () => {
    const o = { windowMonth: 12, ministryDeadline: "2027-03-31" };
    expect(assessmentReminder("2026-11-30", o, false, false)).toBeNull();
    expect(assessmentReminder("2026-12-01", o, false, false)).toBe("aplicar");
    expect(assessmentReminder("2027-01-15", o, true, false)).toBe("registrar");
    expect(assessmentReminder("2027-04-01", o, true, false)).toBeNull();
    expect(assessmentReminder("2027-01-15", o, true, true)).toBeNull();
  });
});
