import { describe, expect, it } from "vitest";
import { coerceCell, parseCsv, rowsFromFile } from "./csv";

describe("CSV de catálogos", () => {
  it("comillas, comas y saltos de línea dentro de celdas", () => {
    expect(parseCsv('a,b\n"x, y","línea 1\nlínea 2"\n"di ""hola""",z')).toEqual([
      ["a", "b"],
      ["x, y", "línea 1\nlínea 2"],
      ['di "hola"', "z"],
    ]);
  });
  it("separador punto y coma (Excel en español), BOM y fin de línea Windows", () => {
    expect(parseCsv("﻿ciiu;name\r\n0111;Cultivo\r\n")).toEqual([
      ["ciiu", "name"],
      ["0111", "Cultivo"],
    ]);
  });
  it("ignora filas vacías y detecta comillas sin cerrar", () => {
    expect(parseCsv("a\n\n\nb\n")).toEqual([["a"], ["b"]]);
    expect(() => parseCsv('a\n"sin cerrar')).toThrow(/comillas/);
  });
  it("interpreta celdas", () => {
    expect(coerceCell(" 12 ")).toBe(12);
    expect(coerceCell("12,5")).toBe(12.5);
    expect(coerceCell("0111")).toBe("0111"); // los códigos con ceros a la izquierda siguen siendo texto
    expect(coerceCell("TRUE")).toBe(true);
    expect(coerceCell("[1,2,3]")).toEqual([1, 2, 3]);
    expect(coerceCell("[no es json")).toBe("[no es json");
    expect(coerceCell("   ")).toBeNull();
  });
  it("archivo CSV → objetos (celdas vacías = campo ausente)", () => {
    const rows = rowsFromFile(
      "ciiu,name,riskClass,sourceNorm\n0111,Cultivo de cereales,2,\n0112,Cultivo de arroz,2,Decreto 768",
    );
    expect(rows).toEqual([
      { ciiu: "0111", name: "Cultivo de cereales", riskClass: 2 },
      { ciiu: "0112", name: "Cultivo de arroz", riskClass: 2, sourceNorm: "Decreto 768" },
    ]);
  });
  it("archivo JSON", () => {
    expect(rowsFromFile('[{"a":1}]', "x.json")).toEqual([{ a: 1 }]);
    expect(() => rowsFromFile('{"a":1}', "x.json")).toThrow(/arreglo/);
  });
});
