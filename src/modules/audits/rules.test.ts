import { describe, expect, it } from "vitest";
import { closeBlockers, findingsOf, parseItems, signBlockers } from "./rules";

const items = parseItems(
  "Política firmada y divulgada\nActas del COPASST al día\nx\nMatriz de peligros vigente",
);

describe("auditoría interna", () => {
  it("la lista de verificación se arma una línea por ítem", () => {
    expect(items.map((i) => i.id)).toEqual(["a1", "a2", "a3"]);
  });
  it("requisitos para cerrar", () => {
    const base = {
      auditorName: "Marta",
      committeeParticipant: "Luis",
      performedOn: "2026-03-01",
      report: "Informe de auditoría con las conclusiones principales",
    };
    expect(closeBlockers({ ...base, checklist: items })).toEqual(["Faltan 3 ítem(s) por evaluar"]);
    const evaluated = items.map((i, n) => ({
      ...i,
      result: (n === 1 ? "major_nc" : "conforms") as "major_nc" | "conforms",
    }));
    expect(closeBlockers({ ...base, checklist: evaluated })).toEqual([
      "Describe el hallazgo: Actas del COPASST al día",
    ]);
    evaluated[1] = { ...evaluated[1], note: "Faltan 3 actas" } as never;
    expect(closeBlockers({ ...base, checklist: evaluated })).toEqual([]);
    expect(
      closeBlockers({
        ...base,
        committeeParticipant: null,
        auditorName: " ",
        report: "corto",
        performedOn: null,
        checklist: evaluated,
      }),
    ).toEqual([
      "Indica la fecha de realización",
      "Indica el auditor",
      "Indica el integrante del COPASST o Vigía que participó",
      "Redacta el informe de auditoría (mínimo 20 caracteres)",
    ]);
  });
  it("hallazgos: no conformidades y observaciones", () => {
    const f = findingsOf([
      { id: "1", text: "a", result: "conforms" },
      { id: "2", text: "b", result: "minor_nc" },
      { id: "3", text: "c", result: "observation" },
      { id: "4", text: "d", result: "na" },
    ]);
    expect(f.map((x) => x.id)).toEqual(["2", "3"]);
  });
});

describe("revisión por la dirección", () => {
  it("para firmar necesita asistentes, conclusiones y decisiones", () => {
    expect(signBlockers({ attendees: "Gerencia", conclusions: null, decisions: "" })).toEqual([
      "Redacta las conclusiones",
      "Registra las decisiones",
    ]);
    expect(
      signBlockers({
        attendees: "Gerencia",
        conclusions: "El sistema es conveniente y adecuado",
        decisions: "Asignar presupuesto",
      }),
    ).toEqual([]);
  });
});
