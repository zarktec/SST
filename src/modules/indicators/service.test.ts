import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { seedHolidays } from "@/core/calendar/service";
import { reportIncident } from "@/modules/incidents/service";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import { createWorker } from "@/modules/workers/service";
import { IndicatorError, dashboard, saveAnalysis, saveTarget } from "./service";

pointToTestDb();
let n = 0;
const mk = () => createTenantWithSubscription(`ix-${++n}`).then((t) => t.id);
const today = new Date().toISOString().slice(0, 10);
const ref = `${today.slice(0, 7)}-01`;
const find = (rows: Awaited<ReturnType<typeof dashboard>>, code: string) =>
  rows.find((r) => r.code === code)!;

describe.skipIf(!hasTestDb)("tablero de indicadores", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
    const y = new Date().getUTCFullYear();
    await seedHolidays([y - 1, y, y + 1]);
  });

  it("calcula la frecuencia con accidentes y trabajadores reales de la empresa", async () => {
    const t = await mk();
    for (let i = 0; i < 4; i++)
      await createWorker(t, "u", {
        kind: "employee",
        idType: "13",
        idNumber: `${1000000 + i * 7}${n}`,
        fullName: `P ${i}`,
        startDate: "2024-01-01",
        position: "Operario",
      });
    await reportIncident(t, "u", {
      kind: "accident",
      occurredDate: today,
      affectedName: "Visitante",
      place: "Bodega",
      description: "Se resbaló en el pasillo",
      severity: "minor",
    });
    const rows = await dashboard(t, ref);
    const f = find(rows, "frecuencia_accidentalidad");
    expect(f.current.measure).toEqual({ numerator: 1, denominator: 4 });
    expect(f.current.value).toBe(25);
    expect(f.points).toHaveLength(6);
    expect(find(rows, "mortalidad_accidentes").current.value).toBe(0);
  });

  it("la meta y el análisis son de cada empresa y aplican a su periodo", async () => {
    const [a, b] = [await mk(), await mk()];
    await saveTarget(a, "u", "frecuencia_accidentalidad", 5);
    let fa = find(await dashboard(a, ref), "frecuencia_accidentalidad");
    expect(fa).toMatchObject({ target: 5, ownTarget: true });
    expect(find(await dashboard(b, ref), "frecuencia_accidentalidad").ownTarget).toBe(false);
    await saveAnalysis(
      a,
      "u",
      "frecuencia_accidentalidad",
      "mensual",
      fa.current.from,
      "Sin eventos este mes",
    );
    await saveAnalysis(
      a,
      "u",
      "frecuencia_accidentalidad",
      "mensual",
      fa.current.from,
      "Sin eventos, se mantiene",
    );
    fa = find(await dashboard(a, ref), "frecuencia_accidentalidad");
    expect(fa.analysis).toBe("Sin eventos, se mantiene");
    expect(find(await dashboard(b, ref), "frecuencia_accidentalidad").analysis).toBeNull();
    await saveTarget(a, "u", "frecuencia_accidentalidad", null);
    expect(find(await dashboard(a, ref), "frecuencia_accidentalidad").ownTarget).toBe(false);
  });

  it("valida la meta y el análisis", async () => {
    const t = await mk();
    await expect(saveTarget(t, "u", "x", -1)).rejects.toBeInstanceOf(IndicatorError);
    await expect(
      saveAnalysis(t, "u", "x", "mensual", "2026-01-01", "corto"),
    ).rejects.toBeInstanceOf(IndicatorError);
  });
});
