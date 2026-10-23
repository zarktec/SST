/**
 * Festivos de Colombia. Fuente: Ley 51 de 1983 ("Ley Emiliani") y Ley 1 de 1992 (festivos religiosos).
 *  - Fijos: 1-ene, 1-may, 20-jul, 7-ago, 8-dic, 25-dic (+ Jueves y Viernes Santo).
 *  - Trasladados al lunes siguiente: 6-ene, 19-mar, 29-jun, 15-ago, 12-oct, 1-nov, 11-nov.
 *  - Basados en Pascua y trasladados al lunes: Ascensión (+39 → +43), Corpus Christi (+60 → +64),
 *    Sagrado Corazón (+68 → +71).
 * TODO-NORMA: validar cada año contra el calendario oficial; el SUPER ADMIN puede corregir la tabla `holiday`.
 * Las fechas son "YYYY-MM-DD" en hora de Colombia (sin horario de verano: aritmética en UTC es segura).
 */

export type Holiday = { date: string; name: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

/** Si la fecha no es lunes, la pasa al lunes siguiente. */
function nextMonday(d: Date): Date {
  const dow = d.getUTCDay(); // 0 dom … 6 sáb
  return dow === 1 ? d : addDays(d, (8 - dow) % 7);
}

export function colombianHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const list: Holiday[] = [
    { date: iso(utc(year, 1, 1)), name: "Año Nuevo" },
    { date: iso(nextMonday(utc(year, 1, 6))), name: "Día de los Reyes Magos" },
    { date: iso(nextMonday(utc(year, 3, 19))), name: "Día de San José" },
    { date: iso(addDays(easter, -3)), name: "Jueves Santo" },
    { date: iso(addDays(easter, -2)), name: "Viernes Santo" },
    { date: iso(utc(year, 5, 1)), name: "Día del Trabajo" },
    { date: iso(nextMonday(addDays(easter, 39))), name: "Ascensión del Señor" },
    { date: iso(nextMonday(addDays(easter, 60))), name: "Corpus Christi" },
    { date: iso(nextMonday(addDays(easter, 68))), name: "Sagrado Corazón de Jesús" },
    { date: iso(nextMonday(utc(year, 6, 29))), name: "San Pedro y San Pablo" },
    { date: iso(utc(year, 7, 20)), name: "Día de la Independencia" },
    { date: iso(utc(year, 8, 7)), name: "Batalla de Boyacá" },
    { date: iso(nextMonday(utc(year, 8, 15))), name: "Asunción de la Virgen" },
    { date: iso(nextMonday(utc(year, 10, 12))), name: "Día de la Raza" },
    { date: iso(nextMonday(utc(year, 11, 1))), name: "Todos los Santos" },
    { date: iso(nextMonday(utc(year, 11, 11))), name: "Independencia de Cartagena" },
    { date: iso(utc(year, 12, 8)), name: "Inmaculada Concepción" },
    { date: iso(utc(year, 12, 25)), name: "Navidad" },
  ];
  return list.sort((x, y) => x.date.localeCompare(y.date));
}
