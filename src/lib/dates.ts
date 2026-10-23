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
