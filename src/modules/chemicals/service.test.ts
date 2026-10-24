import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import {
  ChemicalError,
  chemicalSummary,
  listSubstances,
  retireSubstance,
  saveSubstance,
  updateCompliance,
} from "./service";
import { todayYmd } from "@/lib/dates";

pointToTestDb();
let n = 0;
const mk = () => createTenantWithSubscription(`qu-${++n}`).then((t) => t.id);
const today = todayYmd();

describe.skipIf(!hasTestDb)("inventario químico", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("resumen: FDS, etiquetado y conflictos de almacenamiento", async () => {
    const t = await mk();
    const a = await saveSubstance(t, "u", {
      name: "Acetona",
      location: "Bodega A",
      pictograms: ["GHS02"],
      signalWord: "danger",
    });
    await saveSubstance(t, "u", {
      name: "Peróxido",
      location: "Bodega A",
      pictograms: ["GHS03"],
      signalWord: "danger",
      sdsRevisedOn: today,
      labelCheckedOn: today,
    });
    let s = await chemicalSummary(t);
    expect(s).toMatchObject({ total: 2, withoutSds: 1, unlabeled: 1 });
    expect(s.conflicts).toHaveLength(1);
    await updateCompliance(t, "u", a, { sdsRevisedOn: today, labelCheckedOn: today });
    s = await chemicalSummary(t);
    expect(s).toMatchObject({ withoutSds: 0, unlabeled: 0 });
    await expect(
      updateCompliance(t, "u", a, { sdsRevisedOn: "2999-01-01" }),
    ).rejects.toBeInstanceOf(ChemicalError);
  });

  it("al retirar una sustancia desaparece del inventario y de los conflictos", async () => {
    const t = await mk();
    await saveSubstance(t, "u", {
      name: "Sustancia A",
      location: "Bodega A",
      pictograms: ["GHS02"],
    });
    const b = await saveSubstance(t, "u", {
      name: "Sustancia B",
      location: "Bodega A",
      pictograms: ["GHS03"],
    });
    expect((await chemicalSummary(t)).conflicts).toHaveLength(1);
    await retireSubstance(t, "u", b);
    expect(await listSubstances(t)).toHaveLength(1);
    expect((await chemicalSummary(t)).conflicts).toHaveLength(0);
  });

  it("las sustancias son de cada empresa", async () => {
    const [a, b] = [await mk(), await mk()];
    const id = await saveSubstance(a, "u", { name: "Acetona", location: "Bodega A" });
    await expect(saveSubstance(b, "u", { name: "X1", location: "Y1" }, id)).rejects.toThrow(
      "no encontrada",
    );
    expect(await listSubstances(b)).toHaveLength(0);
  });
});
