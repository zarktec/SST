import { describe, expect, it } from "vitest";
import {
  DEFAULT_COMPETENCIES,
  average,
  cycleSchema,
  isSelfEvaluation,
  tabulate,
  validateRatings,
} from "./rules";

const keys = DEFAULT_COMPETENCIES.map((c) => c.key);
const all = (n: number) => Object.fromEntries(keys.map((k) => [k, n]));

describe("catálogo 360", () => {
  it("tiene las 10 competencias del formato F-RH-45, con las 5 descripciones cada una", () => {
    expect(DEFAULT_COMPETENCIES).toHaveLength(10);
    expect(new Set(keys).size).toBe(10);
    for (const c of DEFAULT_COMPETENCIES)
      for (const n of ["1", "2", "3", "4", "5"] as const)
        expect(c.levels[n].length, `${c.key} ${n}`).toBeGreaterThan(10);
  });
});

describe("tabulador", () => {
  it("promedia por nivel y luego entre niveles que respondieron", () => {
    const t = tabulate(keys, [
      { level: "upper", ratings: all(5) },
      { level: "boss", ratings: all(3) },
      { level: "peer", ratings: all(4) },
      { level: "peer", ratings: all(2) },
    ]);
    expect(t.counts).toEqual({ upper: 1, boss: 1, peer: 2 });
    expect(t.levelTotals).toEqual({ upper: 5, boss: 3, peer: 3 });
    // (5 + 3 + 3) / 3
    expect(t.overall).toBe(3.67);
    expect(t.rows[0].byLevel.peer).toBe(3);
  });
  it("un nivel sin respuestas no baja el promedio", () => {
    const t = tabulate(keys, [{ level: "boss", ratings: all(4) }]);
    expect(t.levelTotals.upper).toBeNull();
    expect(t.overall).toBe(4);
  });
  it("sin respuestas no hay resultado", () => {
    expect(tabulate(keys, []).overall).toBeNull();
    expect(average([])).toBeNull();
  });
});

describe("validación", () => {
  it("exige todas las competencias con enteros de 1 a 5", () => {
    expect(validateRatings(keys, all(4)).ok).toBe(true);
    const bad = validateRatings(keys, { ...all(4), liderazgo: "6", motivacion: "" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.missing.sort()).toEqual(["liderazgo", "motivacion"]);
    expect(validateRatings(keys, { ...all(4), liderazgo: 2.5 }).ok).toBe(false);
  });
  it("nadie se evalúa a sí mismo", () => {
    expect(isSelfEvaluation("a", "a")).toBe(true);
    expect(isSelfEvaluation("a", "b")).toBe(false);
  });
  it("el ciclo pide nombre y fecha", () => {
    expect(cycleSchema.safeParse({ name: "Eva", dueOn: "2026-12-01" }).success).toBe(false);
    expect(cycleSchema.safeParse({ name: "Evaluación 2026", dueOn: "2026-12-01" }).success).toBe(
      true,
    );
  });
});
