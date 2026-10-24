export type Cell = string | number | boolean | null | undefined;
export type Table = { name: string; head: string[]; rows: Cell[][] };
export type Section = { heading: string; text?: string[]; table?: Table };
export type Report = { id: string; title: string; subtitle?: string; sections: Section[] };
export type Brand = { name: string; color: string };

/** Todas las tablas de un informe (una por sección que tenga). */
export const tablesOf = (r: Report): Table[] =>
  r.sections.flatMap((s) => (s.table ? [{ ...s.table, name: s.table.name || s.heading }] : []));

/** Tablas del informe; si no tiene ninguna, el texto de sus secciones como tabla de una columna (para Excel y CSV). */
export function exportTables(r: Report): Table[] {
  const t = tablesOf(r);
  if (t.length) return t;
  return [
    {
      name: "Resumen",
      head: ["Detalle"],
      rows: r.sections.flatMap((s) => (s.text ?? []).map((x) => [x])),
    },
  ];
}
