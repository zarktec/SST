import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, schema, withPlatform } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { approveMatrix, createDraft, saveParticipation, saveRow } from "@/modules/hazards/service";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import {
  getOrCreatePlan,
  getPlan,
  reopenPlan,
  saveActivity,
  setStatus,
  signPlan,
  suggestActivities,
} from "./service";

pointToTestDb();
const act = (over: Record<string, unknown> = {}) => ({
  phva: "P" as const,
  title: "Revisar la política",
  startDate: "2026-02-01",
  endDate: "2026-03-01",
  ...over,
});
let n = 0;
const mk = () => createTenantWithSubscription(`ap-${++n}`).then((t) => t.id);

describe.skipIf(!hasTestDb)("plan anual de trabajo", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("un plan por año; actividades con presupuesto en centavos y fechas dentro del año", async () => {
    const t = await mk();
    const p = await getOrCreatePlan(t, "u", 2026);
    expect((await getOrCreatePlan(t, "u", 2026)).id).toBe(p.id);
    await saveActivity(t, "u", p.id, act({ budgetPesos: 500000 }));
    await expect(
      saveActivity(t, "u", p.id, act({ startDate: "2025-01-01", endDate: "2025-02-01" })),
    ).rejects.toThrow(/dentro de 2026/);
    const d = (await getPlan(t, 2026))!;
    expect(d.activities).toHaveLength(1);
    expect(d.activities[0].budgetCents).toBe(50_000_000n);
    expect(d.progress).toEqual({ total: 1, done: 0, pct: 0 });
  });

  it("completar exige evidencia y mueve el % de cumplimiento", async () => {
    const t = await mk();
    const p = await getOrCreatePlan(t, "u", 2026);
    const id = await saveActivity(t, "u", p.id, act());
    await saveActivity(t, "u", p.id, act({ title: "Capacitar al COPASST" }));
    await expect(setStatus(t, "u", id, "done")).rejects.toThrow(/evidencia/);
    await setStatus(t, "u", id, "done", "Acta 7");
    expect((await getPlan(t, 2026))!.progress).toEqual({ total: 2, done: 1, pct: 50 });
  });

  it("firma de ambas partes; un cambio posterior a una firma la invalida; reabrir limpia firmas", async () => {
    const t = await mk();
    const p = await getOrCreatePlan(t, "u", 2026);
    await expect(signPlan(t, "u", p.id, "employer")).rejects.toThrow(
      /sin actividades|no tiene actividades/,
    );
    const id = await saveActivity(t, "u", p.id, act());
    expect(await signPlan(t, "gerente", p.id, "employer")).toEqual({ signed: false });
    await saveActivity(t, "u", p.id, act({ title: "Revisar la política y objetivos" }), id);
    expect(await signPlan(t, "resp", p.id, "responsible")).toEqual({ signed: false }); // la firma del empleador ya no vale
    expect((await getPlan(t, 2026))!.plan.employerSignedAt).toBeNull();
    expect(await signPlan(t, "gerente", p.id, "employer")).toEqual({ signed: true });
    const signed = (await getPlan(t, 2026))!.plan;
    expect(signed).toMatchObject({
      status: "signed",
      employerSignedBy: "gerente",
      responsibleSignedBy: "resp",
    });
    expect(signed.contentHash).toMatch(/^[0-9a-f]{64}$/);
    await expect(saveActivity(t, "u", p.id, act({ title: "Otra" }))).rejects.toThrow(/firmado/);
    await setStatus(t, "u", id, "in_progress"); // el seguimiento sí se permite
    await reopenPlan(t, "u", p.id);
    expect((await getPlan(t, 2026))!.plan).toMatchObject({
      status: "draft",
      employerSignedBy: null,
      contentHash: null,
    });
  });

  it("sugiere actividades desde mejoramiento y peligros I/II, sin duplicar", async () => {
    const t = await mk();
    // Acción de mejoramiento abierta
    await withPlatform({ actorId: "t", action: "t", tenantId: t, audit: false }, async (tx) => {
      const [a] = await tx
        .insert(schema.selfAssessment)
        .values({ tenantId: t, year: 2026, standardsGroup: 7, status: "closed" })
        .returning();
      await tx.insert(schema.improvementItem).values({
        tenantId: t,
        assessmentId: a.id,
        itemCode: "1.1.1",
        description: "Cumplir: política firmada",
        responsibleName: "Luis",
      });
    });
    // Matriz aprobada con un riesgo I
    const m = await createDraft(t, "u");
    await saveRow(t, "u", m, {
      process: "Mant",
      activity: "Alturas",
      task: "Luminarias",
      routine: true,
      hazardFamily: "Seguridad",
      hazardName: "Caída",
      deficiency: "Muy alto",
      exposure: "Continua",
      consequence: "Mortal o catastrófico",
      ctrlEngineering: "Línea de vida",
    });
    await saveRow(t, "u", m, {
      process: "Mant",
      activity: "Oficina",
      task: "Digitar",
      routine: true,
      hazardFamily: "Biomecánico",
      hazardName: "Postura",
      deficiency: "Medio",
      exposure: "Esporádica",
      consequence: "Leve",
    });
    await saveParticipation(t, "u", m, "Taller");
    await approveMatrix(t, "u", m);
    const p = await getOrCreatePlan(t, "u", 2026);
    expect(await suggestActivities(t, "u", p.id)).toBe(2);
    expect(await suggestActivities(t, "u", p.id)).toBe(0);
    const d = (await getPlan(t, 2026))!;
    expect(d.activities.map((a) => a.source).sort()).toEqual(["hazard", "improvement"]);
    expect(d.activities.find((a) => a.source === "hazard")).toMatchObject({
      objective: "Línea de vida",
      endDate: "2026-03-31",
    });
  });

  it("aísla por empresa", async () => {
    const a = await mk();
    const b = await mk();
    const p = await getOrCreatePlan(a, "u", 2026);
    await expect(saveActivity(b, "u", p.id, act())).rejects.toThrow(/no encontrado/);
    expect(await getPlan(b, 2026)).toBeNull();
  });
});
