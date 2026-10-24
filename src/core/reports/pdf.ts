import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Brand, Report, Table } from "./types";

const W = 595.28;
const H = 841.89;
const M = 42;

/** Helvetica solo admite WinAnsi (Latin-1 + algunos signos): reemplaza el resto para no romper la generación. */
export function winAnsi(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/→/g, "->")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E -ÿ€•]/g, "?");
}
const hex = (c: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c);
  const n = m ? parseInt(m[1], 16) : 0x1d4ed8;
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of winAnsi(text).split(/\r?\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      let w = word;
      while (font.widthOfTextAtSize(w, size) > width) {
        // palabra más larga que la línea: se parte
        let k = w.length;
        while (k > 1 && font.widthOfTextAtSize(w.slice(0, k), size) > width) k--;
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(w.slice(0, k));
        w = w.slice(k);
      }
      const t = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(t, size) <= width) line = t;
      else {
        out.push(line);
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

/** PDF con encabezado de marca (nombre y color de la empresa), secciones de texto y tablas con paginación y pie numerado. */
export async function renderPdf(
  report: Report,
  brand: Brand,
  generatedAt = new Date(),
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const color = hex(brand.color);
  let page: PDFPage;
  let y = 0;
  const newPage = () => {
    page = pdf.addPage([W, H]);
    page.drawRectangle({ x: 0, y: H - 30, width: W, height: 30, color });
    page.drawText(winAnsi(brand.name).slice(0, 70), {
      x: M,
      y: H - 20,
      size: 11,
      font: bold,
      color: rgb(1, 1, 1),
    });
    y = H - 56;
  };
  const ensure = (h: number) => {
    if (y - h < M + 14) newPage();
  };
  newPage();
  for (const line of wrap(report.title, bold, 17, W - 2 * M)) {
    ensure(22);
    page!.drawText(line, { x: M, y, size: 17, font: bold });
    y -= 22;
  }
  if (report.subtitle) {
    for (const line of wrap(report.subtitle, font, 10, W - 2 * M)) {
      ensure(14);
      page!.drawText(line, { x: M, y, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
      y -= 14;
    }
  }
  y -= 8;
  const drawTable = (t: Table) => {
    const cols = t.head.length;
    const width = (W - 2 * M) / cols;
    const size = cols > 6 ? 7 : 8.5;
    const rowH = (cells: string[], f: PDFFont) =>
      Math.max(...cells.map((c) => wrap(c, f, size, width - 6).length)) * (size + 2.5) + 5;
    const drawRow = (cells: string[], f: PDFFont, bg?: ReturnType<typeof rgb>) => {
      const h = rowH(cells, f);
      ensure(h);
      if (bg) page!.drawRectangle({ x: M, y: y - h + 3, width: W - 2 * M, height: h, color: bg });
      cells.forEach((c, i) =>
        wrap(c, f, size, width - 6).forEach((ln, li) =>
          page!.drawText(ln, {
            x: M + i * width + 3,
            y: y - size - li * (size + 2.5),
            size,
            font: f,
          }),
        ),
      );
      page!.drawLine({
        start: { x: M, y: y - h + 3 },
        end: { x: W - M, y: y - h + 3 },
        thickness: 0.4,
        color: rgb(0.8, 0.8, 0.8),
      });
      y -= h;
    };
    drawRow(t.head, bold, rgb(0.93, 0.94, 0.96));
    for (const r of t.rows)
      drawRow(
        r.map((c) => (c === null || c === undefined ? "" : String(c))),
        font,
      );
    if (!t.rows.length) {
      ensure(14);
      page!.drawText("Sin registros.", {
        x: M + 3,
        y: y - 10,
        size: 9,
        font,
        color: rgb(0.45, 0.45, 0.45),
      });
      y -= 16;
    }
  };
  for (const s of report.sections) {
    ensure(40);
    page!.drawText(winAnsi(s.heading), { x: M, y, size: 12.5, font: bold, color });
    y -= 18;
    for (const para of s.text ?? [])
      for (const line of wrap(para, font, 9.5, W - 2 * M)) {
        ensure(13);
        page!.drawText(line, { x: M, y, size: 9.5, font });
        y -= 13;
      }
    if (s.table) {
      y -= 3;
      drawTable(s.table);
    }
    y -= 12;
  }
  const stamp = winAnsi(`Generado el ${generatedAt.toISOString().slice(0, 10)} · ${brand.name}`);
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawText(stamp, { x: M, y: 22, size: 7.5, font, color: rgb(0.5, 0.5, 0.5) });
    p.drawText(`Página ${i + 1} de ${pages.length}`, {
      x: W - M - 70,
      y: 22,
      size: 7.5,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  });
  return pdf.save();
}
