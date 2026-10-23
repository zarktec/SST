/**
 * CSV/JSON → filas para importar a un catálogo. CSV con encabezado; admite comillas dobles, comas y saltos
 * de línea dentro de comillas, y separador `;` (Excel en español). Cada celda se interpreta: número, booleano,
 * JSON (`[1,2]`, `{...}`), vacío = null, o texto.
 */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (quoted) throw new Error("CSV inválido: comillas sin cerrar");
  row.push(cell);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

export function coerceCell(raw: string): unknown {
  const v = raw.trim();
  if (v === "") return null;
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === "true";
  if (/^-?\d+([.,]\d+)?$/.test(v) && !/^0\d/.test(v)) return Number(v.replace(",", "."));
  if (/^[[{]/.test(v)) {
    try {
      return JSON.parse(v);
    } catch {
      /* texto */
    }
  }
  return v;
}

/** Convierte el contenido de un archivo (CSV o JSON array) en filas de objetos. */
export function rowsFromFile(content: string, filename = ""): Record<string, unknown>[] {
  const trimmed = content.trim();
  if (filename.toLowerCase().endsWith(".json") || trimmed.startsWith("[")) {
    const data = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(data)) throw new Error("El JSON debe ser un arreglo de objetos");
    return data as Record<string, unknown>[];
  }
  const [header, ...rest] = parseCsv(content);
  if (!header) throw new Error("El archivo está vacío");
  const keys = header.map((h) => h.trim());
  return rest.map((cells) => {
    const obj: Record<string, unknown> = {};
    keys.forEach((k, i) => {
      const val = coerceCell(cells[i] ?? "");
      if (val !== null) obj[k] = val; // vacío = campo ausente (usa el valor por defecto del esquema)
    });
    return obj;
  });
}
