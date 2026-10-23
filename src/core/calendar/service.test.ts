import { afterAll, describe, expect, it } from "vitest";
import { closeDb, schema, systemDb } from "@/core/db";
import { hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { addBusinessDays } from "./business-days";
import { loadBusinessCalendar, seedHolidays } from "./service";

pointToTestDb();

describe.skipIf(!hasTestDb)("festivos en base de datos", () => {
  afterAll(closeDb);
  it("siembra idempotente y calendario listo para calcular plazos legales", async () => {
    await systemDb().delete(schema.holiday);
    await seedHolidays([2026, 2027]);
    await seedHolidays([2026, 2027]);
    expect(await systemDb().select().from(schema.holiday)).toHaveLength(36);
    const cal = await loadBusinessCalendar(2026, 2027);
    expect(addBusinessDays("2026-10-09", 2, cal)).toBe("2026-10-14");
    expect(cal.holidays.has("2027-05-10")).toBe(true);
  });
  it("las correcciones del SUPER ADMIN no se pisan al volver a sembrar", async () => {
    await systemDb().delete(schema.holiday);
    await seedHolidays([2026]);
    const { eq } = await import("drizzle-orm");
    await systemDb()
      .update(schema.holiday)
      .set({ name: "Corregido" })
      .where(eq(schema.holiday.date, "2026-01-01"));
    await seedHolidays([2026]);
    const [h] = await systemDb()
      .select()
      .from(schema.holiday)
      .where(eq(schema.holiday.date, "2026-01-01"));
    expect(h.name).toBe("Corregido");
  });
});
