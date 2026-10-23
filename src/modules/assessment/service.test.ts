import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, schema, withPlatform } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import {
  createDraft,
  importItems,
  publishVersion,
  seedCatalogs,
} from "@/modules/platform/catalogs/service";
import {
  assessmentReminderFor,
  closeAssessment,
  getAssessment,
  history,
  listImprovements,
  registerWithMinistry,
  setItem,
  startAssessment,
  updateImprovement,
} from "./service";

pointToTestDb();

const std = (itemCode: string, weight: number, groups: (7 | 21 | 60)[]) => ({
  phva: "P",
  standardCode: itemCode.split(".")[0],
  standardName: "Recursos",
  itemCode,
  criterion: `Criterio ${itemCode}`,
  verification: "Documento",
  weight,
  appliesToGroups: groups,
  sourceNorm: "Resolución 0312 de 2019",
});

let n = 0;
async function mk(group: number | null = 7) {
  const t = await createTenantWithSubscription(`as-${++n}`);
  await withPlatform({ actorId: "t", action: "t", tenantId: t.id, audit: false }, (tx) =>
    tx.update(schema.tenant).set({ standardsGroup: group }).where(eq(schema.tenant.id, t.id)),
  );
  return t.id;
}
import { eq } from "drizzle-orm";

describe.skipIf(!hasTestDb)("autoevaluación de estándares mínimos", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
    const d = await createDraft("standards_0312", "t");
    const r = await importItems(
      d.id,
      [std("1.1.1", 4, [7, 21, 60]), std("1.1.2", 6, [7, 21, 60]), std("2.1.1", 10, [21, 60])],
      { strict: true },
    );
    expect(r.errors).toEqual([]);
    await publishVersion(
      d.id,
      { effectiveFrom: "2019-01-01", sourceNorm: "Res. 0312", notes: "test" },
      "t",
    );
  });

  it("solo toma los ítems del grupo de la empresa y no permite duplicar el año", async () => {
    const t = await mk(7);
    const id = await startAssessment(t, "u", 2026);
    expect((await getAssessment(t, id))!.items.map((i) => i.itemCode)).toEqual(["1.1.1", "1.1.2"]);
    await expect(startAssessment(t, "u", 2026)).rejects.toThrow(/Ya existe/);
    const t21 = await mk(21);
    expect((await getAssessment(t21, await startAssessment(t21, "u", 2026)))!.items).toHaveLength(
      3,
    );
  });

  it("exige clasificación previa y catálogo cargado", async () => {
    await expect(startAssessment(await mk(null), "u", 2026)).rejects.toThrow(/onboarding/);
    await expect(startAssessment(await mk(60), "u", 2026)).resolves.toBeTruthy();
  });

  it("no cierra con pendientes; cierra con puntaje, rango y plan de mejoramiento", async () => {
    const t = await mk(7);
    const id = await startAssessment(t, "u", 2026);
    await expect(closeAssessment(t, "u", id)).rejects.toThrow(/Faltan 2/);
    await setItem(t, "u", id, "1.1.1", { status: "cumple", evidence: "Acta 12" });
    await setItem(t, "u", id, "1.1.2", { status: "no_cumple", responsibleName: "Luis" });
    const r = await closeAssessment(t, "u", id);
    expect(r).toMatchObject({ pct: 40, level: "critico", improvements: 1 });
    const [imp] = await listImprovements(t, id);
    expect(imp).toMatchObject({ itemCode: "1.1.2", status: "open", responsibleName: "Luis" });
    await expect(setItem(t, "u", id, "1.1.1", { status: "no_cumple" })).rejects.toThrow(/cerrada/);
    await expect(closeAssessment(t, "u", id)).rejects.toThrow(/ya está cerrada/);
  });

  it("no aplica exige justificación y cuenta completo", async () => {
    const t = await mk(7);
    const id = await startAssessment(t, "u", 2026);
    await setItem(t, "u", id, "1.1.1", { status: "no_aplica" });
    await setItem(t, "u", id, "1.1.2", { status: "cumple" });
    await expect(closeAssessment(t, "u", id)).rejects.toThrow(/requiere justificación/);
    await setItem(t, "u", id, "1.1.1", {
      status: "no_aplica",
      justification: "No manejamos ese proceso",
    });
    expect((await closeAssessment(t, "u", id)).level).toBe("aceptable");
  });

  it("plan de mejoramiento: cerrar exige descripción; histórico compara años; registro ante el Ministerio", async () => {
    const t = await mk(7);
    for (const [year, st] of [
      [2025, "no_cumple"],
      [2026, "cumple"],
    ] as const) {
      const id = await startAssessment(t, "u", year);
      await setItem(t, "u", id, "1.1.1", { status: "cumple" });
      await setItem(t, "u", id, "1.1.2", { status: st });
      await closeAssessment(t, "u", id);
      if (year === 2025) {
        const [imp] = await listImprovements(t, id);
        await expect(updateImprovement(t, "u", imp.id, { status: "done" })).rejects.toThrow(
          /cerró/,
        );
        await updateImprovement(t, "u", imp.id, {
          status: "done",
          closureNote: "Se elaboró el documento",
          dueDate: "2026-03-01",
        });
      }
      if (year === 2026) await registerWithMinistry(t, "u", id, "2026-12-20");
    }
    expect(await history(t)).toEqual([
      { year: 2025, pct: 40, delta: null },
      { year: 2026, pct: 100, delta: 60 },
    ]);
  });

  it("recordatorios por fecha", async () => {
    const t = await mk(7);
    expect(await assessmentReminderFor(t, "2026-06-01")).toBeNull();
    expect(await assessmentReminderFor(t, "2026-12-02")).toBe("aplicar");
    const id = await startAssessment(t, "u", 2026);
    await setItem(t, "u", id, "1.1.1", { status: "cumple" });
    await setItem(t, "u", id, "1.1.2", { status: "cumple" });
    await closeAssessment(t, "u", id);
    expect(await assessmentReminderFor(t, "2026-12-02")).toBeNull();
  });

  it("aislamiento: otra empresa no ve la autoevaluación", async () => {
    const a = await mk(7);
    const b = await mk(7);
    const id = await startAssessment(a, "u", 2026);
    expect(await getAssessment(b, id)).toBeNull();
    await expect(setItem(b, "u", id, "1.1.1", { status: "cumple" })).rejects.toThrow(
      /no encontrada/,
    );
  });
});
