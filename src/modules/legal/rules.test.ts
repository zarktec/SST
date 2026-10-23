import { describe, expect, it } from "vitest";
import { entrySchema, summarize, type MatrixRow } from "./rules";

describe("entrada de la matriz legal", () => {
  const base = { kind: "norm", code: "ley-1562-2012", applies: "yes" } as const;
  it("si no aplica exige justificación y limpia cumplimiento y evidencia", () => {
    expect(entrySchema.safeParse({ ...base, applies: "no" }).success).toBe(false);
    const r = entrySchema.parse({
      ...base,
      applies: "no",
      justification: "No tenemos obras",
      compliance: "cumple",
      evidence: "x",
    });
    expect(r).toMatchObject({ compliance: "pending", evidence: null });
  });
  it("cumple o parcial exigen evidencia", () => {
    expect(entrySchema.safeParse({ ...base, compliance: "cumple" }).success).toBe(false);
    expect(
      entrySchema.safeParse({ ...base, compliance: "parcial", evidence: "Acta 4" }).success,
    ).toBe(true);
    expect(entrySchema.safeParse({ ...base, compliance: "no_cumple" }).success).toBe(true);
  });
  it("fecha de revisión válida", () => {
    expect(entrySchema.safeParse({ ...base, nextReviewDate: "2026-13-99x" }).success).toBe(false);
    expect(entrySchema.parse({ ...base, nextReviewDate: "" }).nextReviewDate).toBeNull();
  });
});

describe("resumen", () => {
  const row = (
    applies: string | null,
    compliance = "pending",
    review: string | null = null,
  ): MatrixRow => ({
    kind: "norm",
    code: "x",
    entry: applies ? { applies, compliance, nextReviewDate: review } : null,
  });
  it("cuenta por estado y calcula el % sobre lo aplicable", () => {
    const s = summarize(
      [
        row(null),
        row("no"),
        row("yes", "cumple"),
        row("yes", "cumple", "2026-01-01"),
        row("yes", "no_cumple"),
        row("yes", "parcial"),
        row("yes"),
      ],
      "2026-10-23",
    );
    expect(s).toMatchObject({
      total: 7,
      unevaluated: 1,
      notApplicable: 1,
      cumple: 2,
      noCumple: 1,
      parcial: 1,
      pendingCompliance: 1,
      reviewDue: 1,
      compliancePct: 40,
    });
  });
  it("sin aplicables el % es 0", () =>
    expect(summarize([row("no")], "2026-10-23").compliancePct).toBe(0));
});
