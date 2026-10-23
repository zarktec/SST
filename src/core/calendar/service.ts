import "server-only";
import { and, gte, lte } from "drizzle-orm";
import { schema, systemDb } from "@/core/db";
import { colombianHolidays } from "./holidays";
import type { BusinessCalendar } from "./business-days";

/** Siembra los festivos de los años indicados (idempotente: no pisa correcciones del SUPER ADMIN). */
export async function seedHolidays(years: number[]) {
  for (const year of years) {
    const rows = colombianHolidays(year).map((h) => ({
      date: h.date,
      name: h.name,
      year,
      source: "calculado (Ley 51/1983 y Ley 1/1992)",
    }));
    await systemDb().insert(schema.holiday).values(rows).onConflictDoNothing();
  }
}

/** Calendario de días hábiles con los festivos guardados en BD en el rango pedido. */
export async function loadBusinessCalendar(
  fromYear: number,
  toYear: number,
): Promise<BusinessCalendar> {
  const rows = await systemDb()
    .select({ date: schema.holiday.date })
    .from(schema.holiday)
    .where(and(gte(schema.holiday.year, fromYear), lte(schema.holiday.year, toYear)));
  return { holidays: new Set(rows.map((r) => r.date)) };
}
