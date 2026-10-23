import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import { listActions } from "@/modules/capa/service";
import { createReport, listReports, reviewReport } from "./service";

pointToTestDb();
let n = 0;
const mk = () => createTenantWithSubscription(`ur-${++n}`).then((t) => t.id);
const base = { kind: "condition" as const, description: "Piso mojado sin señalizar" };

describe.skipIf(!hasTestDb)("reportes de condiciones y actos inseguros", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("un reporte anónimo no guarda quién lo hizo y no aparece en 'mis reportes'", async () => {
    const t = await mk();
    await createReport(t, "u1", { ...base, anonymous: true });
    await createReport(t, "u1", base);
    const all = await listReports(t, { all: true, userId: "u2" });
    expect(all).toHaveLength(2);
    expect(all.find((r) => r.anonymous)?.reportedBy).toBeNull();
    const mine = await listReports(t, { all: false, userId: "u1" });
    expect(mine).toHaveLength(1);
    expect(mine[0].anonymous).toBe(false);
  });

  it("al revisar se crea una acción CAPA vinculada y no se puede revisar dos veces", async () => {
    const t = await mk();
    const id = await createReport(t, "u1", base);
    const actionId = await reviewReport(t, "rev", id, {
      decision: "action",
      title: "Señalizar pisos mojados",
      responsibleName: "Ana",
      dueDate: "2030-01-01",
    });
    const acts = await listActions(t, { status: "all" });
    expect(acts.find((a) => a.id === actionId)).toMatchObject({
      source: "unsafe_report",
      sourceId: id,
    });
    const [r] = await listReports(t, { all: true, userId: "rev" });
    expect(r).toMatchObject({ status: "actioned", actionId });
    await expect(
      reviewReport(t, "rev", id, { decision: "dismiss", note: "ya no aplica" }),
    ).rejects.toThrow("ya fue revisado");
  });

  it("descartar guarda el motivo", async () => {
    const t = await mk();
    const id = await createReport(t, "u1", base);
    await reviewReport(t, "rev", id, { decision: "dismiss", note: "Ya estaba corregido" });
    const [r] = await listReports(t, { all: true, userId: "rev" });
    expect(r).toMatchObject({
      status: "dismissed",
      reviewNote: "Ya estaba corregido",
      actionId: null,
    });
  });
});
