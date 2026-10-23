import { describe, expect, it } from "vitest";
import {
  committeeKindFor,
  electionSchema,
  hashToken,
  meetingGaps,
  newVoteToken,
  renewalState,
  scrutinize,
  validateComposition,
  type MemberDraft,
} from "./rules";

const m = (
  workerId: string,
  representation: MemberDraft["representation"],
  seat: MemberDraft["seat"] = "principal",
): MemberDraft => ({ workerId, representation, seat });

describe("tipo de comité y conformación", () => {
  it("Vigía con menos de 10 trabajadores; COPASST desde 10 (umbral parametrizable)", () => {
    expect(committeeKindFor(9)).toBe("vigia");
    expect(committeeKindFor(10)).toBe("copasst");
    expect(committeeKindFor(20, 25)).toBe("vigia");
  });
  it("paridad, sin repetidos y Vigía de una persona por parte", () => {
    expect(validateComposition("copasst", [m("a", "employer"), m("b", "workers")])).toEqual([]);
    expect(
      validateComposition("copasst", [m("a", "employer"), m("b", "workers"), m("c", "workers")])[0],
    ).toMatch(/paritaria/);
    expect(validateComposition("copasst", [m("a", "employer")])[0]).toMatch(
      /al menos un principal/,
    );
    expect(validateComposition("copasst", [m("a", "employer"), m("a", "workers")])[0]).toMatch(
      /dos puestos/,
    );
    expect(
      validateComposition("vigia", [
        m("a", "employer"),
        m("b", "employer"),
        m("c", "workers"),
        m("d", "workers"),
      ]).join(),
    ).toMatch(/Vigía/);
    expect(
      validateComposition("copasst", [
        m("a", "employer"),
        m("b", "workers"),
        m("c", "employer", "alternate"),
      ]),
    ).toEqual([]);
  });
});

describe("escrutinio", () => {
  const c = (id: string, votes: number) => ({ id, name: id.toUpperCase(), votes });
  it("asigna principales y suplentes por votos", () => {
    const r = scrutinize([c("a", 5), c("b", 9), c("c", 7), c("d", 1)], 2, 1);
    expect(r.tie).toBe(false);
    expect(r.totalVotes).toBe(22);
    expect(r.rows.map((x) => [x.candidateId, x.seat])).toEqual([
      ["b", "principal"],
      ["c", "principal"],
      ["a", "alternate"],
      ["d", null],
    ]);
  });
  it("empate en el corte deja esos puestos sin asignar", () => {
    const r = scrutinize([c("a", 9), c("b", 5), c("c", 5), c("d", 1)], 2, 0);
    expect(r.tie).toBe(true);
    expect(r.rows.map((x) => x.seat)).toEqual(["principal", null, null, null]);
  });
  it("empate dentro del mismo grupo no es empate", () => {
    const r = scrutinize([c("a", 5), c("b", 5), c("c", 1)], 2, 0);
    expect(r.tie).toBe(false);
    expect(r.rows.map((x) => x.seat)).toEqual(["principal", "principal", null]);
  });
  it("empate entre principal y suplente, y sin votos", () => {
    expect(scrutinize([c("a", 3), c("b", 3)], 1, 1).tie).toBe(true);
    expect(scrutinize([c("a", 0), c("b", 0)], 2, 0).tie).toBe(false);
    expect(scrutinize([], 1, 0)).toEqual({ rows: [], tie: false, totalVotes: 0 });
  });
});

describe("tokens, renovación y reuniones", () => {
  it("token aleatorio y hash estable", () => {
    const t = newVoteToken();
    expect(t).toMatch(/^[0-9a-f]{48}$/);
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(t);
  });
  it("renovación", () => {
    expect(renewalState("2027-01-01", "2026-10-23", 60)).toBe("vigente");
    expect(renewalState("2026-12-01", "2026-10-23", 60)).toBe("por_vencer");
    expect(renewalState("2026-10-22", "2026-10-23", 60)).toBe("vencido");
  });
  it("meses sin reunión desde el mes siguiente a la conformación", () => {
    expect(meetingGaps(["2026-02-10", "2026-04-02"], "2026-01-15", "2026-06-10")).toEqual({
      missing: ["2026-03", "2026-05"],
      currentMonthPending: true,
    });
    expect(meetingGaps(["2026-06-01"], "2026-05-20", "2026-06-10")).toEqual({
      missing: [],
      currentMonthPending: false,
    });
    expect(meetingGaps([], "2026-06-05", "2026-06-20")).toEqual({
      missing: [],
      currentMonthPending: false,
    }); // mes de conformación
    expect(meetingGaps([], "2025-12-01", "2026-02-10")).toEqual({
      missing: ["2026-01"],
      currentMonthPending: true,
    });
  });
  it("elección: cierre no anterior a la apertura", () => {
    expect(
      electionSchema.safeParse({
        kind: "copasst",
        principalSeats: 2,
        alternateSeats: 2,
        votingOpensOn: "2026-11-02",
        votingClosesOn: "2026-11-01",
      }).success,
    ).toBe(false);
  });
});
