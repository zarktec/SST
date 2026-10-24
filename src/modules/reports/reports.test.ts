import { strFromU8, unzipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { seedHolidays } from "@/core/calendar/service";
import { tablesOf } from "@/core/reports/types";
import { createAction } from "@/modules/capa/service";
import { reportIncident } from "@/modules/incidents/service";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import { REPORTS, buildInvestigationReport, buildReport } from "./builders";
import { exportAllData } from "./export-all";
import { buildInspectionFolder } from "./inspection-folder";
import { renderReport } from "./render";

pointToTestDb();
let n = 0;
const mk = () => createTenantWithSubscription(`rp-${++n}`).then((t) => t.id);
const today = new Date().toISOString().slice(0, 10);
const year = Number(today.slice(0, 4));
const brand = { name: "Empresa Demo", color: "#0f766e" };

describe.skipIf(!hasTestDb)("informes y exportaciones", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
    await seedHolidays([year - 1, year, year + 1]);
  });

  it("todos los informes se construyen aun sin datos y se renderizan en PDF, Excel y CSV", async () => {
    const t = await mk();
    for (const def of REPORTS) {
      const r = await buildReport(def.id, t, year, "Empresa Demo");
      expect(r, def.id).not.toBeNull();
      for (const f of ["pdf", "xlsx", "csv"] as const) {
        const out = await renderReport(r!, f, brand);
        expect(
          typeof out.body === "string" ? out.body.length : out.body.byteLength,
          `${def.id}.${f}`,
        ).toBeGreaterThan(20);
      }
    }
  });

  it("el informe de eventos y el de investigación incluyen los datos reales", async () => {
    const t = await mk();
    const r = await reportIncident(t, "u", {
      kind: "accident",
      occurredDate: today,
      affectedName: "Pedro Pérez",
      place: "Bodega 2",
      description: "Caída desde una escalera",
      severity: "minor",
    });
    const rep = await buildReport("eventos", t, year, "Empresa Demo");
    expect(tablesOf(rep!)[0].rows[0]).toEqual(
      expect.arrayContaining(["Accidente", "Pedro Pérez", "Bodega 2"]),
    );
    const inv = await buildInvestigationReport(t, r.id, "Empresa Demo");
    expect(inv!.sections[0].text!.join(" ")).toContain("Caída desde una escalera");
    expect(
      await buildInvestigationReport(t, "00000000-0000-4000-8000-000000000000", "X"),
    ).toBeNull();
  });

  it("carpeta de inspección: ZIP por ciclo PHVA con índice y manifiesto; respeta permisos", async () => {
    const t = await mk();
    await createAction(t, "u", {
      type: "corrective",
      title: "Reparar la baranda",
      responsibleName: "Luis",
      dueDate: "2030-01-01",
    });
    const all = await buildInspectionFolder({
      tenantId: t,
      tenantName: "Empresa Demo",
      brand,
      year,
      allow: () => true,
    });
    const files = unzipSync(all.zip);
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        "00-INDICE.pdf",
        "manifest.json",
        "4-Actuar/acciones.pdf",
        "4-Actuar/acciones.xlsx",
        "3-Verificar/indicadores.pdf",
        "1-Planear/plan-anual.pdf",
      ]),
    );
    const manifest = JSON.parse(strFromU8(files["manifest.json"])) as {
      path: string;
      sha256: string;
    }[];
    expect(manifest.every((m) => /^[0-9a-f]{64}$/.test(m.sha256))).toBe(true);
    const limited = await buildInspectionFolder({
      tenantId: t,
      tenantName: "Empresa Demo",
      brand,
      year,
      allow: (m) => m === "actions",
    });
    expect(
      Object.keys(unzipSync(limited.zip))
        .filter((p) => p.endsWith(".pdf"))
        .sort(),
    ).toEqual(["00-INDICE.pdf", "4-Actuar/acciones.pdf"]);
  });

  it("exportación total: un CSV por tabla con datos, sin columnas cifradas ni de facturación", async () => {
    const [a, b] = [await mk(), await mk()];
    await createAction(a, "u", {
      type: "corrective",
      title: "Acción de la empresa A",
      responsibleName: "Luis",
      dueDate: "2030-01-01",
    });
    await createAction(b, "u", {
      type: "corrective",
      title: "Acción de la empresa B",
      responsibleName: "Ana",
      dueDate: "2030-01-01",
    });
    const files = unzipSync(await exportAllData(a, "Empresa A"));
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining(["LEEME.txt", "datos/corrective_action.csv"]),
    );
    const csv = strFromU8(files["datos/corrective_action.csv"]);
    expect(csv).toContain("Acción de la empresa A");
    expect(csv).not.toContain("Acción de la empresa B");
    expect(Object.keys(files).some((p) => /payment|invoice|session/.test(p))).toBe(false);
    for (const [p, data] of Object.entries(files))
      if (p.endsWith(".csv"))
        expect(strFromU8(data).split("\r\n")[0]).not.toMatch(/encrypted|signature|token|hash/i);
  });
});
