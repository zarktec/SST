import type { Cell, Table } from "./types";

const cell = (v: Cell): string => {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutraliza fórmulas (CSV injection) al abrirse en hojas de cálculo.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\r\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** CSV con BOM UTF-8 (Excel respeta las tildes) y fin de línea CRLF. */
export function toCsv(t: Table): string {
  return "﻿" + [t.head, ...t.rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
