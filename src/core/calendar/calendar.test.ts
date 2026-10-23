import { describe, expect, it } from "vitest";
import { addBusinessDays, businessDaysBetween, bogotaDate, isBusinessDay } from "./business-days";
import { colombianHolidays, easterSunday } from "./holidays";

const dates = (y: number) => colombianHolidays(y).map((h) => h.date);

describe("Pascua", () => {
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
    [2028, "2028-04-16"],
  ])("%i", (y, e) => {
    expect(easterSunday(y).toISOString().slice(0, 10)).toBe(e);
  });
});

describe("festivos de Colombia", () => {
  it("2026 coincide con el calendario oficial", () => {
    expect(dates(2026)).toEqual([
      "2026-01-01",
      "2026-01-12",
      "2026-03-23",
      "2026-04-02",
      "2026-04-03",
      "2026-05-01",
      "2026-05-18",
      "2026-06-08",
      "2026-06-15",
      "2026-06-29",
      "2026-07-20",
      "2026-08-07",
      "2026-08-17",
      "2026-10-12",
      "2026-11-02",
      "2026-11-16",
      "2026-12-08",
      "2026-12-25",
    ]);
  });
  it("2027 coincide con el calendario oficial", () => {
    expect(dates(2027)).toEqual([
      "2027-01-01",
      "2027-01-11",
      "2027-03-22",
      "2027-03-25",
      "2027-03-26",
      "2027-05-01",
      "2027-05-10",
      "2027-05-31",
      "2027-06-07",
      "2027-07-05",
      "2027-07-20",
      "2027-08-07",
      "2027-08-16",
      "2027-10-18",
      "2027-11-01",
      "2027-11-15",
      "2027-12-08",
      "2027-12-25",
    ]);
  });
  it("hay 18 festivos por año y los trasladables caen en lunes", () => {
    for (const y of [2026, 2027, 2028, 2029, 2030]) {
      const hs = colombianHolidays(y);
      expect(hs).toHaveLength(18);
      for (const name of [
        "Día de los Reyes Magos",
        "Día de San José",
        "San Pedro y San Pablo",
        "Asunción de la Virgen",
        "Día de la Raza",
        "Todos los Santos",
        "Independencia de Cartagena",
        "Ascensión del Señor",
        "Corpus Christi",
        "Sagrado Corazón de Jesús",
      ]) {
        const h = hs.find((x) => x.name === name)!;
        expect(new Date(`${h.date}T00:00:00Z`).getUTCDay(), `${y} ${name}`).toBe(1);
      }
    }
  });
});

const cal = { holidays: new Set(dates(2026)) };

describe("días hábiles", () => {
  it("fin de semana y festivos no son hábiles", () => {
    expect(isBusinessDay("2026-10-24", cal)).toBe(false); // sábado
    expect(isBusinessDay("2026-10-25", cal)).toBe(false); // domingo
    expect(isBusinessDay("2026-10-12", cal)).toBe(false); // festivo
    expect(isBusinessDay("2026-10-13", cal)).toBe(true);
  });
  it("plazo de 2 días hábiles para el reporte de un AT (accidente un viernes → martes)", () => {
    // Viernes 2026-10-09: +1 lunes 12 (festivo, no cuenta) → martes 13 = 1.º, miércoles 14 = 2.º
    expect(addBusinessDays("2026-10-09", 2, cal)).toBe("2026-10-14");
  });
  it("accidente un lunes normal → miércoles", () => {
    expect(addBusinessDays("2026-10-19", 2, cal)).toBe("2026-10-21");
  });
  it("accidente un sábado: el conteo arranca el siguiente día hábil", () => {
    expect(addBusinessDays("2026-10-24", 1, cal)).toBe("2026-10-26");
  });
  it("0 días devuelve la misma fecha", () => {
    expect(addBusinessDays("2026-10-19", 0, cal)).toBe("2026-10-19");
  });
  it("cruza Semana Santa", () => {
    // Miércoles 1-abr-2026 +2: jue 2 y vie 3 festivos → lunes 6 (1.º), martes 7 (2.º)
    expect(addBusinessDays("2026-04-01", 2, cal)).toBe("2026-04-07");
  });
  it("opción de contar sábados", () => {
    expect(addBusinessDays("2026-10-23", 1, { ...cal, countSaturday: true })).toBe("2026-10-24");
  });
  it("días hábiles entre fechas (simétrico)", () => {
    expect(businessDaysBetween("2026-10-09", "2026-10-14", cal)).toBe(2);
    expect(businessDaysBetween("2026-10-14", "2026-10-09", cal)).toBe(-2);
    expect(businessDaysBetween("2026-10-09", "2026-10-09", cal)).toBe(0);
  });
  it("rechaza n inválido", () => {
    expect(() => addBusinessDays("2026-10-09", -1, cal)).toThrow();
  });
});

describe("fecha en Colombia", () => {
  it("23:30 en Bogotá (04:30 UTC del día siguiente) sigue siendo el día local", () => {
    expect(bogotaDate(new Date("2026-10-24T04:30:00Z"))).toBe("2026-10-23");
    expect(bogotaDate(new Date("2026-10-24T05:00:00Z"))).toBe("2026-10-24");
  });
});
