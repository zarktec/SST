import { describe, expect, it } from "vitest";
import {
  DEFAULT_STAGE_DAYS,
  complaintSchema,
  dueAfter,
  ineligibleForCommittee,
  isFinal,
  isOverdue,
  nextStages,
  validateCclSize,
} from "./rules";

describe("flujo del trámite", () => {
  it("transiciones válidas y finales", () => {
    expect(nextStages("received")).toContain("summoned");
    expect(nextStages("hearing")).toEqual(["agreement", "no_agreement"]);
    expect(nextStages("received")).not.toContain("agreement");
    expect(isFinal("closed")).toBe(true);
    expect(isFinal("referred")).toBe(true);
    expect(isFinal("hearing")).toBe(false);
  });
  it("plazos por etapa y vencimiento", () => {
    const t0 = new Date("2026-10-01T00:00:00Z");
    expect(dueAfter("received", t0, DEFAULT_STAGE_DAYS)?.toISOString()).toBe(
      "2026-10-06T00:00:00.000Z",
    );
    expect(dueAfter("hearing", t0, DEFAULT_STAGE_DAYS)).toBeNull();
    expect(
      isOverdue(
        { stage: "summoned", stageDueAt: new Date("2026-10-05T00:00:00Z") },
        new Date("2026-10-06T00:00:00Z"),
      ),
    ).toBe(true);
    expect(isOverdue({ stage: "closed", stageDueAt: new Date("2020-01-01") }, new Date())).toBe(
      false,
    );
    expect(isOverdue({ stage: "summoned", stageDueAt: null }, new Date())).toBe(false);
  });
});

describe("elegibilidad y tamaño", () => {
  const now = new Date("2026-10-23T00:00:00Z");
  it("excluye a quienes fueron denunciantes o denunciados en el último año", () => {
    const c = [
      { complainantWorkerId: "a", respondentWorkerId: "b", receivedAt: new Date("2026-03-01") },
      { complainantWorkerId: "c", respondentWorkerId: null, receivedAt: new Date("2024-01-01") },
    ];
    expect(ineligibleForCommittee(["a", "b", "c", "d"], c, now)).toEqual(["a", "b"]);
  });
  it("mínimos por parte", () => {
    expect(
      validateCclSize(
        { employerPrincipal: 1, workersPrincipal: 1, employerAlternate: 1, workersAlternate: 1 },
        { principal: 1, alternate: 1 },
      ),
    ).toEqual([]);
    expect(
      validateCclSize(
        { employerPrincipal: 1, workersPrincipal: 0, employerAlternate: 0, workersAlternate: 1 },
        { principal: 1, alternate: 1 },
      ),
    ).toHaveLength(2);
  });
  it("la queja exige relato detallado y convierte vacíos", () => {
    expect(complaintSchema.safeParse({ narrative: "corto" }).success).toBe(false);
    expect(
      complaintSchema.parse({
        narrative: "Hechos ocurridos el pasado lunes en la bodega".padEnd(30, "."),
        anonymous: "on",
        respondentWorkerId: "",
      }),
    ).toMatchObject({ anonymous: true, respondentWorkerId: null });
  });
});
