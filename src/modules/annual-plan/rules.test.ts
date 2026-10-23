import { describe, expect, it } from "vitest";
import {
  activitySchema,
  contentHash,
  isOverdue,
  monthsOf,
  progress,
  suggestFromHazard,
  suggestFromImprovement,
} from "./rules";

describe("actividades", () => {
  const base = {
    phva: "P",
    title: "Revisar política",
    startDate: "2026-02-01",
    endDate: "2026-03-15",
  };
  it("valida fechas y presupuesto", () => {
    expect(activitySchema.parse({ ...base, budgetPesos: "150000" }).budgetPesos).toBe(150000);
    expect(activitySchema.parse({ ...base, budgetPesos: "" }).budgetPesos).toBeNull();
    expect(activitySchema.safeParse({ ...base, endDate: "2026-01-01" }).success).toBe(false);
    expect(activitySchema.safeParse({ ...base, title: "ab" }).success).toBe(false);
  });
  it("cumplimiento excluye canceladas; vencidas solo pendientes o en curso", () => {
    expect(
      progress([
        { status: "done" },
        { status: "pending" },
        { status: "cancelled" },
        { status: "done" },
      ]),
    ).toEqual({ total: 3, done: 2, pct: 66.67 });
    expect(progress([])).toEqual({ total: 0, done: 0, pct: 0 });
    expect(isOverdue({ status: "pending", endDate: "2026-01-01" }, "2026-10-23")).toBe(true);
    expect(isOverdue({ status: "done", endDate: "2026-01-01" }, "2026-10-23")).toBe(false);
  });
  it("meses del cronograma", () => {
    expect(monthsOf({ startDate: "2026-02-15", endDate: "2026-04-02" }, 2026)).toEqual([2, 3, 4]);
    expect(monthsOf({ startDate: "2025-11-01", endDate: "2026-01-10" }, 2026)).toEqual([1]);
  });
});

describe("huella y sugerencias", () => {
  const it1 = {
    phva: "P",
    title: "A",
    objective: null,
    responsibleName: null,
    startDate: "2026-01-01",
    endDate: "2026-02-01",
    resources: null,
    budgetCents: null,
    status: "pending",
  };
  it("la huella no depende del orden, ignora canceladas y cambia con el contenido", () => {
    const it2 = { ...it1, title: "B" };
    const h = contentHash(2026, [it1, it2]);
    expect(contentHash(2026, [it2, it1])).toBe(h);
    expect(contentHash(2026, [it1, it2, { ...it1, title: "C", status: "cancelled" }])).toBe(h);
    expect(contentHash(2026, [it1, { ...it2, endDate: "2026-03-01" }])).not.toBe(h);
    expect(contentHash(2027, [it1, it2])).not.toBe(h);
  });
  it("sugerencias desde mejoramiento y peligros", () => {
    expect(
      suggestFromImprovement(
        { id: "1", description: "Cumplir X", responsibleName: "Ana", dueDate: "2026-05-01" },
        2026,
      ),
    ).toMatchObject({ endDate: "2026-05-01", phva: "A" });
    expect(
      suggestFromImprovement(
        { id: "1", description: "X", responsibleName: null, dueDate: "2025-05-01" },
        2026,
      ).endDate,
    ).toBe("2026-12-31");
    expect(
      suggestFromHazard(
        {
          id: "h",
          hazardName: "Altura",
          task: "Cambio",
          riskLevel: "III",
          ctrlEliminationOrBetter: null,
        },
        2026,
      ),
    ).toBeNull();
    expect(
      suggestFromHazard(
        {
          id: "h",
          hazardName: "Altura",
          task: "Cambio",
          riskLevel: "I",
          ctrlEliminationOrBetter: null,
        },
        2026,
      )?.endDate,
    ).toBe("2026-03-31");
  });
});
