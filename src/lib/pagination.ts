export const PAGE_SIZE = 25;

/** Lee `?p=` (1-based) y devuelve límite y desplazamiento para la consulta. */
export function parsePage(sp: Record<string, string | string[] | undefined>, size = PAGE_SIZE) {
  const raw = Number(typeof sp.p === "string" ? sp.p : 1);
  const page = Number.isInteger(raw) && raw >= 1 && raw <= 10_000 ? raw : 1;
  return { page, size, limit: size, offset: (page - 1) * size };
}
export const pageCount = (total: number, size = PAGE_SIZE) => Math.max(1, Math.ceil(total / size));
