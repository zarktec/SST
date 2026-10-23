/** Suma meses a una fecha AAAA-MM-DD; si el día no existe en el mes destino queda el último día del mes (31 ene + 1 mes = 28/29 feb). */
export function addMonths(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const out = new Date(Date.UTC(y, m - 1 + n, d));
  if (out.getUTCDate() !== d) out.setUTCDate(0);
  return out.toISOString().slice(0, 10);
}

export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
export const todayYmd = (): string => new Date().toISOString().slice(0, 10);

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(date) + n * 86_400_000).toISOString().slice(0, 10);
}
/** Días entre dos fechas AAAA-MM-DD contando ambos extremos (una incapacidad del 1 al 3 son 3 días). */
export const daysInclusive = (start: string, end: string): number =>
  Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
