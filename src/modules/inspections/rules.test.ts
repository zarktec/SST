import { describe, expect, it } from "vitest";
import { parseItems, submissionErrors, summarize, templateSchema } from "./rules";

const items = parseItems("* Extintores cargados\nSalidas despejadas\n* Botiquín completo");

describe("plantillas de inspección", () => {
  it("una línea por ítem; * marca obligatorio; ids estables", () => {
    expect(items).toEqual([
      { id: "i1", text: "Extintores cargados", required: true },
      { id: "i2", text: "Salidas despejadas", required: false },
      { id: "i3", text: "Botiquín completo", required: true },
    ]);
  });
  it("exige nombre, categoría y al menos un ítem", () => {
    expect(
      templateSchema.safeParse({ name: "Locativa", category: "Locativa", itemsText: "\n" }).success,
    ).toBe(false);
    expect(
      templateSchema.safeParse({ name: "Locativa", category: "Locativa", itemsText: "Pisos" })
        .success,
    ).toBe(true);
  });
});

describe("validación de la inspección", () => {
  it("los ítems obligatorios deben responderse (no vale 'no aplica')", () => {
    expect(submissionErrors(items, [{ itemId: "i1", result: "ok" }])).toEqual([
      "Responde el ítem obligatorio: Botiquín completo",
    ]);
    expect(
      submissionErrors(items, [
        { itemId: "i1", result: "na" },
        { itemId: "i3", result: "ok" },
      ]),
    ).toEqual(["Responde el ítem obligatorio: Extintores cargados"]);
  });
  it("un hallazgo exige descripción", () => {
    expect(
      submissionErrors(items, [
        { itemId: "i1", result: "ok" },
        { itemId: "i2", result: "fail", note: " " },
        { itemId: "i3", result: "ok" },
      ]),
    ).toEqual(["Describe el hallazgo: Salidas despejadas"]);
  });
  it("rechaza ítems que no están en la plantilla", () => {
    expect(
      submissionErrors(items, [
        { itemId: "i1", result: "ok" },
        { itemId: "i3", result: "ok" },
        { itemId: "zz", result: "ok" },
      ]),
    ).toEqual(["Ítem desconocido"]);
  });
  it("cumplimiento = cumple / (cumple + no cumple); 'no aplica' no cuenta", () => {
    expect(
      summarize([{ result: "ok" }, { result: "ok" }, { result: "fail" }, { result: "na" }]),
    ).toEqual({
      ok: 2,
      fail: 1,
      compliancePct: 67,
    });
    expect(summarize([{ result: "na" }]).compliancePct).toBeNull();
  });
});
