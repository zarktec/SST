import { describe, expect, it } from "vitest";
import { SEEDS } from "@/modules/platform/catalogs/seed-data";
import {
  byPriority,
  controlWarnings,
  hazardRowSchema,
  reviewDue,
  valuate,
  type Scale,
} from "./rules";

const scales = SEEDS.find((s) => s.catalog === "gtc45_scales")!.items as unknown as Scale[];
const v = (d: string, e: string, c: string) =>
  valuate({ deficiency: d, exposure: e, consequence: c }, scales);

describe("valoración GTC 45", () => {
  it("Muy alto × Continua × Mortal: NP 40, NR 4000, nivel I no aceptable", () => {
    expect(v("Muy alto", "Continua", "Mortal o catastrófico")).toMatchObject({
      valued: true,
      np: 40,
      nr: 4000,
      probabilityLevel: "Muy alto",
      riskLevel: "I",
      acceptability: "No aceptable",
    });
  });
  it("Medio × Ocasional × Grave: NP 4 (Bajo), NR 100 → III Mejorable", () => {
    expect(v("Medio", "Ocasional", "Grave")).toMatchObject({
      np: 4,
      nr: 100,
      probabilityLevel: "Bajo",
      riskLevel: "III",
      acceptability: "Mejorable",
    });
  });
  it("Alto × Frecuente × Muy grave: NP 18, NR 1080 → I", () => {
    expect(v("Alto", "Frecuente", "Muy grave")).toMatchObject({
      np: 18,
      nr: 1080,
      probabilityLevel: "Alto",
      riskLevel: "I",
    });
  });
  it("Medio × Esporádica × Leve: NR 20 → IV Aceptable", () => {
    expect(v("Medio", "Esporádica", "Leve")).toMatchObject({
      np: 2,
      nr: 20,
      riskLevel: "IV",
      acceptability: "Aceptable",
    });
  });
  it("Medio × Continua × Leve: NP 8, NR 80 → III", () => {
    expect(v("Medio", "Continua", "Leve")).toMatchObject({ nr: 80, riskLevel: "III" });
  });
  it("niveles desconocidos o deficiencia sin valor no se valoran", () => {
    expect(v("Inventado", "Continua", "Grave").valued).toBe(false);
    expect(
      valuate({ deficiency: "Bajo", exposure: "Continua", consequence: "Grave" }, [
        ...scales,
        { dimension: "deficiency", level: "Bajo", value: null, min: null, max: null, meaning: "" },
      ]).valued,
    ).toBe(false);
  });
});

describe("prioridad, controles y revisión", () => {
  it("ordena por NR descendente con los no valorados al final", () => {
    expect(byPriority([{ nr: 20 }, { nr: null }, { nr: 4000 }]).map((r) => r.nr)).toEqual([
      4000,
      20,
      null,
    ]);
  });
  it("advierte riesgo no aceptable sin controles y la jerarquía de controles", () => {
    const high = v("Muy alto", "Continua", "Mortal o catastrófico");
    expect(controlWarnings(high, {})).toEqual(["Riesgo no aceptable sin controles propuestos"]);
    expect(controlWarnings(high, { ctrlEpp: "Arnés" })).toEqual([
      "Considera eliminación, sustitución o controles de ingeniería antes de controles administrativos o EPP",
    ]);
    expect(controlWarnings(high, { ctrlEngineering: "Línea de vida" })).toEqual([]);
    expect(controlWarnings(v("Medio", "Esporádica", "Leve"), {})).toEqual([]);
  });
  it("revisión: sin aprobar o vencidos los meses", () => {
    expect(reviewDue(null, new Date(), 12)).toBe(true);
    expect(reviewDue(new Date("2025-10-23T00:00:00Z"), new Date("2026-10-22T00:00:00Z"), 12)).toBe(
      false,
    );
    expect(reviewDue(new Date("2025-10-23T00:00:00Z"), new Date("2026-10-23T00:00:00Z"), 12)).toBe(
      true,
    );
  });
  it("esquema de fila: rutinaria desde formulario y campos opcionales", () => {
    const r = hazardRowSchema.parse({
      process: "Producción",
      activity: "Soldadura",
      task: "Soldar tubería",
      routine: "on",
      hazardFamily: "Físico",
      hazardName: "Ruido",
      deficiency: "Alto",
      exposure: "Continua",
      consequence: "Grave",
      effects: "",
    });
    expect(r).toMatchObject({ routine: true, effects: null, exposedWorkers: 0 });
  });
});
