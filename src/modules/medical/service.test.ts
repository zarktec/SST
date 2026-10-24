import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { closeDb, schema, withPlatform } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { devOutbox } from "@/core/mail";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import { createWorker } from "@/modules/workers/service";
import {
  absenteeismStats,
  addAbsence,
  closeAbsence,
  completeAdaptation,
  getEvaluation,
  listAdaptationTasks,
  listEvaluations,
  pendingReturnEvaluations,
  periodicStatus,
  recordResult,
  scheduleEvaluation,
  sendProfileToIps,
} from "./service";
import { todayYmd } from "@/lib/dates";

pointToTestDb();
let n = 0;
const mk = () => createTenantWithSubscription(`md-${++n}`).then((t) => t.id);
const person = (t: string, doc: string, startDate = "2024-01-01") =>
  createWorker(t, "u", {
    kind: "employee",
    idType: "13",
    idNumber: doc + n,
    fullName: `P ${doc}`,
    startDate,
    position: "Operario",
  });
const today = todayYmd();
const logs = (t: string) =>
  withPlatform({ actorId: "t", action: "t", tenantId: t, audit: false }, (tx) =>
    tx.select().from(schema.sensitiveAccessLog),
  );

describe.skipIf(!hasTestDb)("medicina del trabajo y ausentismo", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("bloquea pruebas de embarazo, VIH o serología en la programación y en el resultado", async () => {
    const t = await mk();
    const w = await person(t, "1000000");
    await expect(
      scheduleEvaluation(t, "u", {
        workerId: w,
        type: "preingreso",
        scheduledDate: today,
        requestNote: "incluir prueba de embarazo",
      }),
    ).rejects.toThrow(/discriminatorio/);
    const id = await scheduleEvaluation(t, "u", {
      workerId: w,
      type: "preingreso",
      scheduledDate: today,
      ipsName: "IPS Salud",
    });
    await expect(
      recordResult(t, "u", {
        evaluationId: id,
        performedDate: today,
        concept: "apto",
        recommendations: "se descartó VIH",
      }),
    ).rejects.toThrow(/discriminatorio/);
    await expect(
      scheduleEvaluation(t, "u", { workerId: w, type: "inventado", scheduledDate: today }),
    ).rejects.toThrow(/no válido/);
  });

  it("con restricciones crea la tarea de adaptación a 20 días; el resultado va cifrado y la lectura se registra", async () => {
    const t = await mk();
    const w = await person(t, "2000000");
    const id = await scheduleEvaluation(t, "u", {
      workerId: w,
      type: "periodica",
      scheduledDate: today,
    });
    const r = await recordResult(t, "u", {
      evaluationId: id,
      performedDate: "2026-10-01",
      concept: "apto_restricciones",
      restrictions: "No levantar más de 10 kg",
      recommendations: "Pausas activas",
      costPesos: "85000",
    });
    expect(r.taskDue).toBe("2026-10-21");
    const [task] = await listAdaptationTasks(t);
    expect(task).toMatchObject({ dueDate: "2026-10-21", status: "open", workerName: "P 2000000" });
    const raw = await withPlatform({ actorId: "t", action: "t", tenantId: t, audit: false }, (tx) =>
      tx.execute(
        sql`select restrictions_encrypted, recommendations_encrypted from medical_evaluation where tenant_id = ${t}`,
      ),
    );
    expect(JSON.stringify(raw.rows)).not.toMatch(/levantar|Pausas/);
    const list = await listEvaluations(t);
    expect(JSON.stringify(list, (_, v) => (typeof v === "bigint" ? String(v) : v))).not.toMatch(
      /levantar|Pausas/,
    );
    const before = (await logs(t)).length;
    const d = (await getEvaluation(t, "reader", id))!;
    expect(d.restrictions).toBe("No levantar más de 10 kg");
    expect(d.costCents).toBe(8_500_000n);
    expect((await logs(t)).length).toBe(before + 1);
    await expect(completeAdaptation(t, "u", task.id, "x")).rejects.toThrow(/Describe/);
    await completeAdaptation(t, "u", task.id, "Se reubicó en el puesto de empaque");
    expect((await listAdaptationTasks(t))[0].status).toBe("done");
    await expect(
      recordResult(t, "u", { evaluationId: id, performedDate: today, concept: "apto" }),
    ).rejects.toThrow(/ya tiene resultado/);
  });

  it("apto sin hallazgos no crea tarea; la periódica fija la siguiente fecha", async () => {
    const t = await mk();
    const w = await person(t, "3000000");
    const id = await scheduleEvaluation(t, "u", {
      workerId: w,
      type: "periodica",
      scheduledDate: today,
    });
    await recordResult(t, "u", { evaluationId: id, performedDate: "2026-06-30", concept: "apto" });
    expect(await listAdaptationTasks(t)).toHaveLength(0);
    expect((await listEvaluations(t))[0].nextDueDate).toBe("2027-06-30");
    const st = (await periodicStatus(t)).find((p) => p.workerId === w)!;
    expect(st).toMatchObject({ due: "2027-06-30", state: "al_dia" });
  });

  it("estado periódico: sin evaluaciones se cuenta desde el ingreso", async () => {
    const t = await mk();
    const old = await person(t, "4000000", "2020-01-01");
    const recent = await person(t, "5000000", today);
    const s = await periodicStatus(t);
    expect(s.find((p) => p.workerId === old)!.state).toBe("vencida");
    expect(s.find((p) => p.workerId === recent)!.state).toBe("al_dia");
  });

  it("ausencia no médica de más de 90 días exige evaluación de retorno; se cumple al registrarla", async () => {
    const t = await mk();
    const w = await person(t, "6000000");
    await addAbsence(t, "u", {
      workerId: w,
      cause: "license",
      startDate: "2026-01-01",
      endDate: "2026-05-01",
    });
    await addAbsence(t, "u", {
      workerId: w,
      cause: "common_illness",
      startDate: "2026-06-01",
      endDate: "2026-09-30",
    });
    expect((await pendingReturnEvaluations(t)).map((a) => a.cause)).toEqual(["license"]);
    const id = await scheduleEvaluation(t, "u", {
      workerId: w,
      type: "retorno_laboral",
      scheduledDate: today,
    });
    await recordResult(t, "u", { evaluationId: id, performedDate: "2026-05-05", concept: "apto" });
    expect(await pendingReturnEvaluations(t)).toHaveLength(0);
  });

  it("ausentismo: días por causa en el periodo, costo y tasa; ausencia en curso se cierra", async () => {
    const t = await mk();
    const [a, b] = [await person(t, "7000000"), await person(t, "8000000")];
    await addAbsence(t, "u", {
      workerId: a,
      cause: "common_illness",
      startDate: "2026-09-28",
      endDate: "2026-10-04",
      costPesos: "700000",
    });
    const open = await addAbsence(t, "u", {
      workerId: b,
      cause: "work_accident",
      startDate: "2026-10-20",
    });
    await closeAbsence(t, "u", open, "2026-10-22");
    await expect(closeAbsence(t, "u", open, "2026-10-01")).rejects.toThrow(/anterior/);
    const s = await absenteeismStats(t, "2026-10-01", "2026-10-31");
    expect(s.lostDays).toBe(4 + 3);
    expect(s.workers).toBe(2);
    expect(s.rate).toBe(Math.round((7 / (2 * 31)) * 10000) / 100);
    expect(s.causes.find((c) => c.cause === "common_illness")).toMatchObject({
      days: 4,
      cases: 1,
      cost: 70_000_000n,
    });
  });

  it("envía el perfil a la IPS sin datos de salud y con la advertencia de pruebas prohibidas", async () => {
    const t = await mk();
    const w = await person(t, "9000000");
    const id = await scheduleEvaluation(t, "u", {
      workerId: w,
      type: "preingreso",
      scheduledDate: today,
    });
    devOutbox.length = 0;
    await sendProfileToIps(t, "u", id, "ips@salud.co");
    expect(devOutbox).toHaveLength(1);
    expect(devOutbox[0].html).toMatch(
      /No se solicitan ni se deben practicar pruebas de embarazo, VIH ni serología/,
    );
    await expect(sendProfileToIps(t, "u", id, "no-correo")).rejects.toThrow(/inválido/);
  });

  it("aísla por empresa", async () => {
    const a = await mk();
    const b = await mk();
    const w = await person(a, "1100000");
    const id = await scheduleEvaluation(a, "u", {
      workerId: w,
      type: "preingreso",
      scheduledDate: today,
    });
    expect(await getEvaluation(b, "u", id)).toBeNull();
    await expect(
      recordResult(b, "u", { evaluationId: id, performedDate: today, concept: "apto" }),
    ).rejects.toThrow(/no encontrada/);
    expect(await listEvaluations(b)).toHaveLength(0);
  });
});
