import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { listActions } from "@/modules/capa/service";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import {
  InspectionError,
  getInspection,
  listInspections,
  saveTemplate,
  submitInspection,
} from "./service";

pointToTestDb();
let n = 0;
const mk = () => createTenantWithSubscription(`is-${++n}`).then((t) => t.id);
const tpl = (t: string) =>
  saveTemplate(t, "u", {
    name: "Locativa",
    category: "Locativa",
    itemsText: "* Pisos secos\nSalidas libres",
  });
const sub = (templateId: string, over: Record<string, unknown> = {}) => ({
  offlineId: crypto.randomUUID(),
  templateId,
  performedAt: new Date().toISOString(),
  place: "Bodega",
  results: [
    { itemId: "i1", result: "fail" as const, note: "Piso mojado" },
    { itemId: "i2", result: "ok" as const },
  ],
  ...over,
});

describe.skipIf(!hasTestDb)("inspecciones", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("registra la inspección con copia del ítem y crea una acción por hallazgo", async () => {
    const t = await mk();
    const id = await tpl(t);
    const r = await submitInspection(t, "u", "Ana", sub(id));
    expect(r).toMatchObject({ created: true, failCount: 1 });
    const d = await getInspection(t, r.id);
    expect(d!.inspection).toMatchObject({ okCount: 1, failCount: 1, inspectorName: "Ana" });
    expect(d!.inspection.results[0]).toMatchObject({ text: "Pisos secos", note: "Piso mojado" });
    expect(d!.actions).toHaveLength(1);
    expect(d!.actions[0]).toMatchObject({ source: "inspection", responsibleName: "Ana" });
  });

  it("reenviar el mismo offlineId no duplica la inspección ni las acciones", async () => {
    const t = await mk();
    const id = await tpl(t);
    const s = sub(id);
    const a = await submitInspection(t, "u", "Ana", s);
    const b = await submitInspection(t, "u", "Ana", s);
    expect(b).toMatchObject({ id: a.id, created: false });
    expect(await listInspections(t)).toHaveLength(1);
    expect(
      (await listActions(t, { status: "all" })).filter((x) => x.source === "inspection"),
    ).toHaveLength(1);
  });

  it("dos envíos simultáneos del mismo offlineId no fallan ni duplican", async () => {
    const t = await mk();
    const id = await tpl(t);
    const s = sub(id);
    const [a, b] = await Promise.all([
      submitInspection(t, "u", "Ana", s),
      submitInspection(t, "u", "Ana", s),
    ]);
    expect(a.id).toBe(b.id);
    expect([a.created, b.created].filter(Boolean)).toHaveLength(1);
    expect(await listInspections(t)).toHaveLength(1);
  });

  it("rechaza respuestas incompletas, hallazgos sin descripción y fechas futuras", async () => {
    const t = await mk();
    const id = await tpl(t);
    await expect(
      submitInspection(t, "u", "Ana", sub(id, { results: [{ itemId: "i2", result: "ok" }] })),
    ).rejects.toThrow("Responde el ítem obligatorio");
    await expect(
      submitInspection(t, "u", "Ana", sub(id, { results: [{ itemId: "i1", result: "fail" }] })),
    ).rejects.toThrow("Describe el hallazgo");
    await expect(
      submitInspection(
        t,
        "u",
        "Ana",
        sub(id, { performedAt: new Date(Date.now() + 86_400_000).toISOString() }),
      ),
    ).rejects.toBeInstanceOf(InspectionError);
  });

  it("una plantilla de otra empresa no se puede usar", async () => {
    const [a, b] = [await mk(), await mk()];
    const id = await tpl(a);
    await expect(submitInspection(b, "u", "Ana", sub(id))).rejects.toThrow(
      "Plantilla no encontrada",
    );
  });
});
