import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, schema, withPlatform } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import { createWorker } from "@/modules/workers/service";
import { DEFAULT_COMPETENCIES } from "./rules";
import {
  addAssignment,
  addSubject,
  closeCycle,
  createCycle,
  cycleDetail,
  cycleResults,
  formFor,
  getSettings,
  listCycles,
  myClosedCycles,
  myPending,
  removeAssignment,
  saveSettings,
  submitResponse,
} from "./service";

pointToTestDb();
let n = 0;
const mk = (modules: string[] = ["evaluacion_360"]) =>
  createTenantWithSubscription(`pf-${++n}`, { modules }).then((t) => t.id);
const person = (t: string, name: string, email: string | null) =>
  createWorker(t, "u", {
    kind: "employee",
    idType: "13",
    idNumber: `${5000000 + ++n}`,
    fullName: name,
    email: email ?? undefined,
    startDate: "2024-01-01",
    position: "Analista",
  });
const rate = (v: number) => Object.fromEntries(DEFAULT_COMPETENCIES.map((c) => [c.key, v]));

describe.skipIf(!hasTestDb)("Evaluación 360", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("es un módulo por plan: sin él no se puede crear nada", async () => {
    const t = await mk([]);
    await expect(
      createCycle(t, "u", { name: "Ciclo 2026", dueOn: "2026-12-01" }),
    ).rejects.toMatchObject({
      code: "MODULE_DISABLED",
    });
  });

  it("el ajuste de anonimato es de la empresa; por defecto es anónimo y el ciclo guarda su copia", async () => {
    const t = await mk();
    expect((await getSettings(t)).anonymous).toBe(true);
    const c1 = await createCycle(t, "u", { name: "Ciclo anónimo", dueOn: "2026-12-01" });
    await saveSettings(t, "u", false);
    expect((await getSettings(t)).anonymous).toBe(false);
    const c2 = await createCycle(t, "u", { name: "Ciclo abierto", dueOn: "2026-12-01" });
    const cycles = await listCycles(t);
    expect(cycles.find((c) => c.id === c1)?.anonymous).toBe(true);
    expect(cycles.find((c) => c.id === c2)?.anonymous).toBe(false);
    expect(cycles[0].competencies).toHaveLength(10);
  });

  async function setup(anonymous: boolean) {
    const t = await mk();
    await saveSettings(t, "u", anonymous);
    const cycle = await createCycle(t, "u", { name: "Ciclo 2026", dueOn: "2026-12-01" });
    const ana = await person(t, "Ana Evaluada", "ana@x.co");
    const boss = await person(t, "Beto Jefe", "beto@x.co");
    const peer = await person(t, "Pepe Igual", "pepe@x.co");
    const subject = await addSubject(t, "u", { cycleId: cycle, workerId: ana });
    const aBoss = await addAssignment(t, "u", {
      subjectId: subject,
      level: "boss",
      evaluatorWorkerId: boss,
    });
    const aPeer = await addAssignment(t, "u", {
      subjectId: subject,
      level: "peer",
      evaluatorWorkerId: peer,
    });
    return { t, cycle, ana, boss, peer, subject, aBoss, aPeer };
  }

  it("reglas de asignación: sin autoevaluación, sin duplicados, evaluador con correo", async () => {
    const s = await setup(false);
    await expect(
      addAssignment(s.t, "u", { subjectId: s.subject, level: "peer", evaluatorWorkerId: s.ana }),
    ).rejects.toThrow("a sí misma");
    await expect(
      addAssignment(s.t, "u", { subjectId: s.subject, level: "boss", evaluatorWorkerId: s.boss }),
    ).rejects.toThrow("ya está asignado");
    await expect(addSubject(s.t, "u", { cycleId: s.cycle, workerId: s.ana })).rejects.toThrow(
      "ya está",
    );
    const sinCorreo = await person(s.t, "Sin Correo", null);
    await expect(
      addAssignment(s.t, "u", {
        subjectId: s.subject,
        level: "upper",
        evaluatorWorkerId: sinCorreo,
      }),
    ).rejects.toThrow("no tiene correo");
  });

  it("solo el evaluador asignado responde, una sola vez, con todas las competencias", async () => {
    const s = await setup(false);
    expect((await myPending(s.t, "BETO@x.co")).map((p) => p.subject)).toEqual(["Ana Evaluada"]);
    expect(await myPending(s.t, "ana@x.co")).toEqual([]);
    expect(await formFor(s.t, "pepe@x.co", s.aBoss)).toBeNull();
    expect((await formFor(s.t, "beto@x.co", s.aBoss))?.competencies).toHaveLength(10);
    await expect(submitResponse(s.t, "ub", "pepe@x.co", s.aBoss, rate(5))).rejects.toThrow(
      "no encontrada",
    );
    await expect(
      submitResponse(s.t, "ub", "beto@x.co", s.aBoss, { ...rate(5), liderazgo: "9" }),
    ).rejects.toThrow("Califica todas");
    await submitResponse(s.t, "ub", "beto@x.co", s.aBoss, rate(5), "Excelente");
    await expect(submitResponse(s.t, "ub", "beto@x.co", s.aBoss, rate(1))).rejects.toThrow(
      "Ya respondiste",
    );
    expect(await myPending(s.t, "beto@x.co")).toEqual([]);
    await expect(removeAssignment(s.t, "u", s.aBoss)).rejects.toThrow("ya fue respondida");
    await removeAssignment(s.t, "u", s.aPeer);
  });

  it("ciclo anónimo: la respuesta no guarda quién la envió ni la hora real", async () => {
    const s = await setup(true);
    await submitResponse(s.t, "ub", "beto@x.co", s.aBoss, rate(4), "Comentario");
    const rows = await withPlatform(
      { actorId: "t", action: "test", tenantId: s.t, audit: false },
      (tx) => tx.select().from(schema.perfResponse),
    );
    const mine = rows.filter((r) => r.tenantId === s.t);
    expect(mine).toHaveLength(1);
    expect(mine[0].evaluatorWorkerId).toBeNull();
    const [cyc] = await listCycles(s.t);
    expect(mine[0].submittedAt.getTime()).toBe(cyc.createdAt.getTime());
    // el administrador sí ve quién respondió (para insistir), pero nunca qué respondió
    const detail = await cycleDetail(s.t, s.cycle);
    expect(detail[0].assignments.find((a) => a.level === "boss")?.submittedAt).not.toBeNull();
  });

  it("ciclo identificado: la respuesta guarda al evaluador", async () => {
    const s = await setup(false);
    await submitResponse(s.t, "ub", "pepe@x.co", s.aPeer, rate(3));
    const rows = await withPlatform(
      { actorId: "t", action: "test", tenantId: s.t, audit: false },
      (tx) => tx.select().from(schema.perfResponse),
    );
    expect(rows.find((r) => r.tenantId === s.t)?.evaluatorWorkerId).toBe(s.peer);
  });

  it("resultados: tabulados por nivel; la persona evaluada solo los ve con el ciclo cerrado y solo los suyos", async () => {
    const s = await setup(true);
    await submitResponse(s.t, "ub", "beto@x.co", s.aBoss, rate(5), "Muy buena");
    await submitResponse(s.t, "up", "pepe@x.co", s.aPeer, rate(3));
    const all = await cycleResults(s.t, s.cycle);
    expect(all?.results[0].tab.levelTotals).toMatchObject({ boss: 5, peer: 3, upper: null });
    expect(all?.results[0].tab.overall).toBe(4);
    expect(all?.results[0].comments).toEqual([{ level: "boss", text: "Muy buena" }]);
    // evaluada: aún abierto → nada
    expect(await cycleResults(s.t, s.cycle, { onlySubjectWorkerId: s.ana })).toBeNull();
    await closeCycle(s.t, "u", s.cycle);
    const own = await cycleResults(s.t, s.cycle, { onlySubjectWorkerId: s.ana });
    expect(own?.results).toHaveLength(1);
    expect(
      (await cycleResults(s.t, s.cycle, { onlySubjectWorkerId: s.boss }))?.results,
    ).toHaveLength(0);
    expect((await myClosedCycles(s.t, s.ana)).map((c) => c.id)).toEqual([s.cycle]);
    // cerrado: no se agrega ni se responde más
    await expect(addSubject(s.t, "u", { cycleId: s.cycle, workerId: s.boss })).rejects.toThrow(
      "cerrado",
    );
    await expect(closeCycle(s.t, "u", s.cycle)).rejects.toThrow("cerrado");
  });
});
