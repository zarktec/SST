import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/core/db";
import { dbErrorMessage as dbErrorMessageLike } from "@/core/db/test-utils";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import {
  approveMatrix,
  createDraft,
  deleteRow,
  getMatrix,
  listMatrices,
  reviewStatus,
  saveParticipation,
  saveRow,
} from "./service";
import type { HazardRowInput } from "./rules";

pointToTestDb();
const row = (over: Partial<HazardRowInput> = {}): HazardRowInput => ({
  process: "Producción",
  activity: "Soldadura",
  task: "Soldar tubería",
  routine: true,
  hazardFamily: "Físico",
  hazardName: "Ruido",
  deficiency: "Alto",
  exposure: "Continua",
  consequence: "Grave",
  ...over,
});
let n = 0;
const mk = () => createTenantWithSubscription(`hz-${++n}`).then((t) => t.id);

describe.skipIf(!hasTestDb)("matriz de peligros GTC 45", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("valora automáticamente al guardar y ordena por riesgo", async () => {
    const t = await mk();
    const m = await createDraft(t, "u");
    await saveRow(
      t,
      "u",
      m,
      row({
        hazardName: "Ruido",
        deficiency: "Medio",
        exposure: "Esporádica",
        consequence: "Leve",
      }),
    );
    await saveRow(
      t,
      "u",
      m,
      row({
        hazardName: "Altura",
        deficiency: "Muy alto",
        exposure: "Continua",
        consequence: "Mortal o catastrófico",
      }),
    );
    const d = (await getMatrix(t, m))!;
    expect(d.rows.map((r) => r.hazardName)).toEqual(["Altura", "Ruido"]);
    expect(d.rows[0]).toMatchObject({ np: 40, nr: 4000, riskLevel: "I" });
    expect(d.summary).toMatchObject({ total: 2, I: 1, IV: 1, unvalued: 0 });
    expect(d.warnings.get(d.rows[0].id)).toEqual(["Riesgo no aceptable sin controles propuestos"]);
  });

  it("no aprueba sin filas, sin participación o con filas sin valorar; aprueba y versiona", async () => {
    const t = await mk();
    const m = await createDraft(t, "u");
    await expect(approveMatrix(t, "u", m)).rejects.toThrow(/no tiene peligros/);
    await saveRow(t, "u", m, row());
    await expect(approveMatrix(t, "u", m)).rejects.toThrow(/participaron/);
    await saveParticipation(t, "u", m, "Taller con el COPASST y 12 trabajadores");
    await approveMatrix(t, "u", m);
    expect((await listMatrices(t))[0]).toMatchObject({
      version: 1,
      status: "approved",
      reason: "initial",
    });
    // Inmutable
    await expect(saveRow(t, "u", m, row({ hazardName: "Otro" }))).rejects.toThrow(/borrador/);
    await expect(deleteRow(t, "u", m, "x")).rejects.toThrow(/borrador/);
    // Nueva versión copia las filas y reemplaza la anterior al aprobar
    const m2 = await createDraft(t, "u", "serious_accident");
    expect((await getMatrix(t, m2))!.rows).toHaveLength(1);
    await expect(createDraft(t, "u")).rejects.toThrow(/borrador en curso/);
    await approveMatrix(t, "u", m2);
    const all = await listMatrices(t);
    expect(all.map((x) => [x.version, x.status, x.reason])).toEqual([
      [2, "approved", "serious_accident"],
      [1, "superseded", "initial"],
    ]);
  });

  it("el trigger de base de datos impide modificar filas de una versión aprobada", async () => {
    const t = await mk();
    const m = await createDraft(t, "u");
    const rid = await saveRow(t, "u", m, row());
    await saveParticipation(t, "u", m, "Participación");
    await approveMatrix(t, "u", m);
    const { withPlatform, schema } = await import("@/core/db");
    const { eq } = await import("drizzle-orm");
    const msg = await dbErrorMessageLike(
      withPlatform({ actorId: "t", action: "t", tenantId: t, audit: false }, (tx) =>
        tx.update(schema.hazardRow).set({ hazardName: "X" }).where(eq(schema.hazardRow.id, rid)),
      ),
    );
    expect(msg).toMatch(/inmutable/);
  });

  it("revisión anual: pendiente sin matriz aprobada; al día tras aprobarla", async () => {
    const t = await mk();
    expect(await reviewStatus(t)).toMatchObject({ due: true, hasApproved: false });
    const m = await createDraft(t, "u");
    await saveRow(t, "u", m, row());
    await saveParticipation(t, "u", m, "x");
    await approveMatrix(t, "u", m);
    expect(await reviewStatus(t)).toMatchObject({ due: false, hasApproved: true });
    expect((await reviewStatus(t, new Date(Date.now() + 400 * 86_400_000))).due).toBe(true);
  });

  it("aísla por empresa", async () => {
    const a = await mk();
    const b = await mk();
    const m = await createDraft(a, "u");
    expect(await getMatrix(b, m)).toBeNull();
    await expect(saveRow(b, "u", m, row())).rejects.toThrow(/no encontrada/);
  });
});
