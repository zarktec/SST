import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { listActions } from "@/modules/capa/service";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import { createWorker } from "@/modules/workers/service";
import {
  EmergencyError,
  addAsset,
  addBrigadeMember,
  completeDrill,
  emergencySummary,
  inspectAsset,
  listAssets,
  listBrigade,
  listPlans,
  savePlan,
  scheduleDrill,
} from "./service";
import { todayYmd } from "@/lib/dates";

pointToTestDb();
let n = 0;
const mk = () => createTenantWithSubscription(`em-${++n}`).then((t) => t.id);
const today = todayYmd();
const person = (t: string) =>
  createWorker(t, "u", {
    kind: "employee",
    idType: "13",
    idNumber: `${2000000 + n}`,
    fullName: "Brigadista Uno",
    startDate: "2024-01-01",
    position: "Operario",
  });

describe.skipIf(!hasTestDb)("emergencias", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("equipo: estado de vigencia e inspección; un equipo en mal estado genera acción", async () => {
    const t = await mk();
    const id = await addAsset(t, "u", {
      kind: "extinguisher",
      code: "EXT-1",
      location: "Pasillo 2",
      expiresOn: "2020-01-01",
    });
    let [a] = await listAssets(t);
    expect(a).toMatchObject({ expiry: "vencido", inspection: "sin_inspeccion" });
    await inspectAsset(t, "u", "Ana", id, {
      performedOn: today,
      ok: false,
      note: "Manómetro en rojo",
    });
    [a] = await listAssets(t);
    expect(a.inspection).toBe("al_dia");
    expect(
      (await listActions(t, { status: "all" })).filter((x) => x.source === "inspection"),
    ).toHaveLength(1);
    await expect(
      inspectAsset(t, "u", "Ana", id, { performedOn: "2999-01-01", ok: true }),
    ).rejects.toBeInstanceOf(EmergencyError);
  });

  it("brigada: no duplica persona y rol", async () => {
    const t = await mk();
    const w = await person(t);
    await addBrigadeMember(t, "u", { workerId: w, role: "fire", joinedOn: "2025-01-01" });
    await expect(
      addBrigadeMember(t, "u", { workerId: w, role: "fire", joinedOn: "2025-01-01" }),
    ).rejects.toThrow("ya integra");
    await addBrigadeMember(t, "u", { workerId: w, role: "first_aid", joinedOn: "2025-01-01" });
    expect(await listBrigade(t)).toHaveLength(2);
  });

  it("plan: un plan por sede (general sin sede), se actualiza y calcula la revisión", async () => {
    const t = await mk();
    const p = {
      vulnerability: "high",
      vulnerabilityAnalysis: "Zona de inundación y carga combustible",
      reviewedOn: "2025-01-10",
    };
    await savePlan(t, "u", p);
    await savePlan(t, "u", { ...p, vulnerability: "low" });
    const plans = await listPlans(t);
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      vulnerability: "low",
      nextReviewOn: "2026-01-10",
      reviewDue: true,
    });
  });

  it("simulacro: al registrarlo cuenta para el año y cada mejora crea una acción (idempotente por simulacro)", async () => {
    const t = await mk();
    expect((await emergencySummary(t)).drills.ok).toBe(false);
    const id = await scheduleDrill(t, "u", {
      scenario: "Evacuación por incendio",
      plannedOn: today,
    });
    await completeDrill(t, "u", id, {
      performedOn: today,
      participants: "12",
      evaluation: "Evacuación completa en 5 minutos",
      improvements: "Señalizar la ruta B\nInstalar luz de emergencia",
    });
    const s = await emergencySummary(t);
    expect(s.drills).toMatchObject({ done: 1, ok: true });
    expect(
      (await listActions(t, { status: "all" })).filter((x) => x.source === "drill"),
    ).toHaveLength(2);
    await expect(
      completeDrill(t, "u", id, { performedOn: today, evaluation: "Otra evaluación larga" }),
    ).rejects.toThrow("ya fue registrado");
  });
});
