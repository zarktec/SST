import { strFromU8, unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";
import { renderPdf, winAnsi } from "./pdf";
import { tablesOf, type Report } from "./types";
import { toXlsx } from "./xlsx";
import { buildZip } from "./zip";

const table = {
  name: "Datos",
  head: ["Nombre", "Valor"],
  rows: [
    ['Ana, "la jefa"', 3],
    ["=CMD()", null],
    ["Línea\nnueva", "1,5"],
  ] as (string | number | null)[][],
};

describe("exportaciones", () => {
  it("CSV: BOM, comillas, saltos de línea y neutralización de fórmulas", () => {
    const csv = toCsv(table);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"Ana, ""la jefa""",3');
    expect(csv).toContain("'=CMD()");
    expect(csv).toContain('"Línea\nnueva"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("XLSX: libro válido con una hoja por tabla, texto escapado y nombres únicos", () => {
    const bytes = toXlsx([
      table,
      { ...table, name: "Datos" },
      { name: "A/B?*", head: ["x"], rows: [["<&>"]] },
    ]);
    const files = unzipSync(bytes);
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        "[Content_Types].xml",
        "xl/workbook.xml",
        "xl/worksheets/sheet1.xml",
        "xl/worksheets/sheet3.xml",
      ]),
    );
    const wb = strFromU8(files["xl/workbook.xml"]);
    expect(wb).toContain('name="Datos"');
    expect(wb).toContain('name="Datos 2"');
    expect(wb).toContain('name="A B"');
    const s1 = strFromU8(files["xl/worksheets/sheet1.xml"]);
    expect(s1).toContain("<v>3</v>");
    expect(s1).toContain("Ana, &quot;la jefa&quot;");
    expect(strFromU8(files["xl/worksheets/sheet3.xml"])).toContain("&lt;&amp;&gt;");
  });

  it("ZIP: rutas con carpetas y huella SHA-256 por archivo", () => {
    const { zip, manifest } = buildZip([
      { path: "1-Planear/a.txt", data: "hola" },
      { path: "2-Hacer/b.bin", data: new Uint8Array([1, 2, 3]) },
    ]);
    expect(Object.keys(unzipSync(zip)).sort()).toEqual(["1-Planear/a.txt", "2-Hacer/b.bin"]);
    expect(manifest[0]).toMatchObject({
      path: "1-Planear/a.txt",
      bytes: 4,
      sha256: "b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79",
    });
  });

  it("PDF: se genera, pagina tablas largas y tolera caracteres fuera de WinAnsi", async () => {
    const rows = Array.from({ length: 120 }, (_, i) => [
      `Fila ${i} → ñandú — “ok”`,
      "x".repeat(60),
      i,
    ]);
    const report: Report = {
      id: "t",
      title:
        "Informe de prueba con un título bastante largo para forzar el ajuste de línea en la primera página",
      subtitle: "Periodo 2026",
      sections: [
        {
          heading: "Resumen",
          text: ["Texto de ejemplo con tildes: acción, año, corrección.", "Segundo párrafo."],
        },
        { heading: "Datos", table: { name: "Datos", head: ["A", "B", "C"], rows } },
      ],
    };
    const bytes = await renderPdf(
      report,
      { name: "Empresa Demo S.A.S.", color: "#0f766e" },
      new Date("2026-06-01T00:00:00Z"),
    );
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(2);
    expect(winAnsi("→ “a” — ñ ✓")).toBe('-> "a" - ñ ?');
    expect(tablesOf(report).map((t) => t.name)).toEqual(["Datos"]);
  });
});
