import { describe, expect, it } from "vitest";
import { compatibilityConflicts, sdsState, substanceIssues, substanceSchema } from "./rules";

const s = (id: string, name: string, location: string, pictograms: string[]) => ({
  id,
  name,
  location,
  pictograms,
});

describe("riesgo químico (SGA)", () => {
  it("detecta incompatibilidades solo entre sustancias del mismo lugar", () => {
    const c = compatibilityConflicts([
      s("1", "Acetona", "Bodega A", ["GHS02", "GHS07"]),
      s("2", "Peróxido de hidrógeno", " bodega a ", ["GHS03"]),
      s("3", "Hipoclorito", "Bodega B", ["GHS03"]),
      s("4", "Ácido muriático", "Bodega A", ["GHS05"]),
    ]);
    expect(c).toEqual([
      {
        location: "Bodega A",
        a: "Acetona",
        b: "Peróxido de hidrógeno",
        reason: "Inflamable con Comburente",
      },
      {
        location: "Bodega A",
        a: "Acetona",
        b: "Ácido muriático",
        reason: "Inflamable con Corrosivo",
      },
    ]);
  });
  it("sin conflictos cuando los pictogramas son compatibles", () => {
    expect(
      compatibilityConflicts([s("1", "A", "X1", ["GHS07"]), s("2", "B", "X1", ["GHS09"])]),
    ).toEqual([]);
  });
  it("FDS: sin ficha, vigente o por revisar (cada N años)", () => {
    expect(sdsState(null, "2026-06-01", 5)).toBe("sin_fds");
    expect(sdsState("2021-06-01", "2026-06-01", 5)).toBe("vigente");
    expect(sdsState("2021-05-31", "2026-06-01", 5)).toBe("por_revisar");
  });
  it("hallazgos de la sustancia", () => {
    expect(
      substanceIssues(
        { pictograms: [], signalWord: "none", sdsRevisedOn: null, labelCheckedOn: null },
        "2026-06-01",
        5,
      ),
    ).toEqual([
      "Sin ficha de datos de seguridad (FDS)",
      "Etiquetado sin verificar",
      "Sin clasificación SGA",
    ]);
    expect(
      substanceIssues(
        {
          pictograms: ["GHS02"],
          signalWord: "danger",
          sdsRevisedOn: "2026-01-01",
          labelCheckedOn: "2026-01-01",
        },
        "2026-06-01",
        5,
      ),
    ).toEqual([]);
  });
  it("valida el número CAS", () => {
    const base = { name: "Acetona", location: "Bodega A" };
    expect(substanceSchema.safeParse({ ...base, casNumber: "67-64-1" }).success).toBe(true);
    expect(substanceSchema.safeParse({ ...base, casNumber: "6764" }).success).toBe(false);
  });
});
