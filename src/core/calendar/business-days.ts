/**
 * Días hábiles con calendario de festivos. Las fechas son "YYYY-MM-DD" (hora de Colombia).
 * TODO-NORMA: por defecto el sábado NO es hábil (lunes a viernes), que es el criterio habitual de los
 * términos legales administrativos; hacerlo parametrizable por norma cuando un experto lo confirme.
 */
export type BusinessCalendar = { holidays: ReadonlySet<string>; countSaturday?: boolean };

const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fmt = (d: Date) => d.toISOString().slice(0, 10);

export function isBusinessDay(date: string, cal: BusinessCalendar): boolean {
  const dow = parse(date).getUTCDay();
  if (dow === 0) return false;
  if (dow === 6 && !cal.countSaturday) return false;
  return !cal.holidays.has(date);
}

/** Suma `n` días hábiles. El día de partida no cuenta; si cae en día no hábil, se cuenta desde el siguiente hábil. */
export function addBusinessDays(start: string, n: number, cal: BusinessCalendar): string {
  if (!Number.isInteger(n) || n < 0) throw new Error("n debe ser un entero no negativo");
  let d = parse(start);
  let left = n;
  while (left > 0) {
    d = new Date(d.getTime() + 86_400_000);
    if (isBusinessDay(fmt(d), cal)) left--;
  }
  return fmt(d);
}

/** Días hábiles entre dos fechas (excluye `from`, incluye `to`). Negativo si `to` es anterior. */
export function businessDaysBetween(from: string, to: string, cal: BusinessCalendar): number {
  if (from === to) return 0;
  const sign = from < to ? 1 : -1;
  const [a, b] = sign === 1 ? [from, to] : [to, from];
  let d = parse(a);
  const end = parse(b);
  let count = 0;
  while (d < end) {
    d = new Date(d.getTime() + 86_400_000);
    if (isBusinessDay(fmt(d), cal)) count++;
  }
  return sign * count;
}

/** Fecha de hoy en Colombia ("YYYY-MM-DD"), independiente de la zona horaria del servidor. */
export function todayInBogota(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Convierte un instante a su fecha calendario en Colombia. */
export const bogotaDate = todayInBogota;
