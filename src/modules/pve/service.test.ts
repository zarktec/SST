import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, schema, withPlatform } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { listActions } from "@/modules/capa/service";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import { createWorker } from "@/modules/workers/service";
import {
  PveError,
  addActivity,
  addFollowup,
  closeCase,
  completeActivity,
  getCase,
  listCases,
  listPrograms,
  listPsychosocial,
  openCase,
  pveSummary,
  recordPsychosocial,
  saveProgram,
} from "./service";
import { todayYmd } from "@/lib/dates";

pointToTestDb();
let n = 0;
const mk = () => createTenantWithSubscription(`pve-${++n}`).then((t) => t.id);
const today = todayYmd();
const person = (t: string) =>
  createWorker(t, "u", {
    kind: "employee",
    idType: "13",
    idNumber: `${5000000 + n}`,
    fullName: "Pedro Operario",
    startDate: "2024-01-01",
    position: "Operario",
  });
const rawNotes = (t: string) =>
  withPlatform({ actorId: "t", action: "t", tenantId: t, audit: false }, async (tx) => ({
    cases: await tx.select().from(schema.pveCase),
    fups: await tx.select().from(schema.pveFollowup),
    logs: await tx.select().from(schema.sensitiveAccessLog),
  }));

describe.skipIf(!hasTestDb)("PVE y riesgo psicosocial", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("un programa activo por tipo; actividades con seguimiento de vencidas", async () => {
    const t = await mk();
    const p = await saveProgram(t, "u", {
      type: "auditory",
      name: "PVE auditivo",
      startedOn: "2026-01-01",
    });
    await expect(
      saveProgram(t, "u", { type: "auditory", name: "Otro auditivo", startedOn: "2026-01-01" }),
    ).rejects.toThrow("Ya hay un programa");
    await addActivity(t, "u", {
      programId: p,
      description: "Audiometrías de la población",
      plannedOn: "2020-01-01",
    });
    const a = (await listPrograms(t))[0].activities[0];
    expect(a.overdue).toBe(true);
    await completeActivity(t, "u", a.id, { performedOn: today, participants: "20" });
    expect((await listPrograms(t))[0].activities[0]).toMatchObject({
      overdue: false,
      participants: 20,
    });
  });

  it("casos: notas cifradas en BD, lectura con registro de acceso, seguimiento y cierre", async () => {
    const t = await mk();
    const p = await saveProgram(t, "u", {
      type: "musculoskeletal",
      name: "PVE osteomuscular",
      startedOn: "2026-01-01",
    });
    const w = await person(t);
    const c = await openCase(t, "u", {
      programId: p,
      workerId: w,
      openedOn: today,
      riskLevel: "high",
      nextFollowUpOn: "2020-01-01",
      notes: "Dolor lumbar recurrente por manipulación de cargas",
    });
    await expect(
      openCase(t, "u", { programId: p, workerId: w, openedOn: today, riskLevel: "low" }),
    ).rejects.toBeInstanceOf(PveError);
    expect((await listCases(t))[0]).toMatchObject({
      followUp: "vencido",
      workerName: "Pedro Operario",
    });
    expect(JSON.stringify(await listCases(t))).not.toContain("lumbar");
    await addFollowup(t, "u", c, {
      performedOn: today,
      note: "Control con fisioterapia, mejora parcial",
      nextFollowUpOn: "2999-01-01",
    });
    expect((await listCases(t))[0].followUp).toBe("al_dia");
    const raw = await rawNotes(t);
    expect(raw.cases[0].notesEncrypted).not.toContain("lumbar");
    expect(raw.fups[0].noteEncrypted).not.toContain("fisioterapia");
    const d = await getCase(t, "reader", c);
    expect(d!.notes).toContain("lumbar");
    expect(d!.followups[0].note).toContain("fisioterapia");
    expect(
      (await rawNotes(t)).logs.filter((l) => l.entity === "pve_case" && l.actorId === "reader"),
    ).toHaveLength(1);
    await closeCase(t, "u", c, today);
    await expect(
      addFollowup(t, "u", c, { performedOn: today, note: "Seguimiento tardío" }),
    ).rejects.toThrow("cerrado");
    expect((await pveSummary(t)).openCases).toBe(0);
  });

  it("psicosocial: próxima aplicación según el nivel y plan de intervención en CAPA", async () => {
    const t = await mk();
    expect((await listPsychosocial(t)).state).toBe("sin_aplicar");
    const r = await recordPsychosocial(t, "u", {
      appliedOn: "2025-02-10",
      psychologistName: "Dra. Ana Ruiz",
      licenseNumber: "SST-12345",
      riskLevel: "high",
      interventions: "Capacitar en manejo del estrés\nRevisar cargas de trabajo",
      responsibleName: "Marta",
    });
    expect(r.nextDueOn).toBe("2026-02-10");
    expect((await listPsychosocial(t)).state).toBe("vencida");
    expect(
      (await listActions(t, { status: "all" })).filter((a) => a.source === "pve"),
    ).toHaveLength(2);
    await expect(
      recordPsychosocial(t, "u", {
        appliedOn: "2999-01-01",
        psychologistName: "Ana Ruiz",
        licenseNumber: "SST-1",
        riskLevel: "low",
      }),
    ).rejects.toBeInstanceOf(PveError);
  });
});
