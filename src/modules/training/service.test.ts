import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import { createWorker } from "@/modules/workers/service";
import {
  certificateData,
  closeSession,
  competenceMatrix,
  createSession,
  getSession,
  openSession,
  publicSessionByToken,
  registerManualAttendance,
  saveCourse,
  setQuestions,
  setRequirement,
  signAttendanceByToken,
} from "./service";

pointToTestDb();
const sig = `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(400, 7)]).toString("base64")}`;
let n = 0;
const mk = () => createTenantWithSubscription(`tr-${++n}`).then((t) => t.id);
const person = (t: string, doc: string, position = "Operario") =>
  createWorker(t, "u", {
    kind: "employee",
    idType: "13",
    idNumber: doc,
    fullName: `Persona ${doc}`,
    startDate: "2024-01-01",
    position,
  });

describe.skipIf(!hasTestDb)("capacitación", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("flujo QR: abrir sesión, firmar con documento, no duplicar, cerrar invalida el QR", async () => {
    const t = await mk();
    await person(t, "1032456789");
    const course = await saveCourse(t, "u", {
      name: "Inducción SST",
      kind: "induction",
      validityMonths: "12",
    });
    const s = await createSession(t, "u", { courseId: course, date: "2026-10-01" });
    expect(await publicSessionByToken(t, "x".repeat(48))).toBeNull();
    const token = await openSession(t, "u", s);
    expect(await openSession(t, "u", s)).toBe(token); // idempotente: el QR no cambia
    expect((await publicSessionByToken(t, token))?.courseName).toBe("Inducción SST");
    const r = await signAttendanceByToken(t, token, {
      document: "1032456789",
      signature: sig,
      ip: "10.0.0.1",
      userAgent: "Mozilla",
    });
    expect(r).toMatchObject({ name: "Persona 1032456789", passed: true });
    await expect(
      signAttendanceByToken(t, token, { document: "1032456789", signature: sig }),
    ).rejects.toThrow(/Ya registraste/);
    await expect(
      signAttendanceByToken(t, token, { document: "999999999", signature: sig }),
    ).rejects.toThrow(/No encontramos/);
    await expect(
      signAttendanceByToken(t, token, { document: "1032456789", signature: "no-firma" }),
    ).rejects.toThrow(/firma/);
    const d = (await getSession(t, s))!;
    expect(d.attendees[0]).toMatchObject({ method: "qr", ip: "10.0.0.1", hasSignature: true });
    expect(d.attendees[0].evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    await closeSession(t, "u", s);
    expect(await publicSessionByToken(t, token)).toBeNull();
    await expect(openSession(t, "u", s)).rejects.toThrow(/cerrada/);
  });

  it("un token de otra empresa no sirve", async () => {
    const a = await mk();
    const b = await mk();
    await person(a, "1032456789");
    const course = await saveCourse(a, "u", { name: "Curso", kind: "specific" });
    const token = await openSession(
      a,
      "u",
      await createSession(a, "u", { courseId: course, date: "2026-10-01" }),
    );
    expect(await publicSessionByToken(b, token)).toBeNull();
    await expect(
      signAttendanceByToken(b, token, { document: "1032456789", signature: sig }),
    ).rejects.toThrow(/no está abierta/);
  });

  it("evaluación: calcula puntaje, aprueba o reprueba y exige responder todo", async () => {
    const t = await mk();
    await person(t, "111111111");
    await person(t, "222222222");
    const course = await saveCourse(t, "u", { name: "Alturas", kind: "specific", passScore: "70" });
    await setQuestions(t, "u", course, [
      { question: "¿Línea de vida obligatoria?", options: ["Sí", "No"], correctIndex: 0 },
      { question: "¿Revisar el arnés?", options: ["Nunca", "Siempre"], correctIndex: 1 },
    ]);
    const token = await openSession(
      t,
      "u",
      await createSession(t, "u", { courseId: course, date: "2026-10-02" }),
    );
    const pub = await publicSessionByToken(t, token);
    expect(JSON.stringify(pub)).not.toContain("correctIndex");
    await expect(
      signAttendanceByToken(t, token, { document: "111111111", signature: sig, answers: [0] }),
    ).rejects.toThrow(/Responde todas/);
    expect(
      await signAttendanceByToken(t, token, {
        document: "111111111",
        signature: sig,
        answers: [0, 1],
      }),
    ).toMatchObject({ score: 100, passed: true });
    expect(
      await signAttendanceByToken(t, token, {
        document: "222222222",
        signature: sig,
        answers: [1, 1],
      }),
    ).toMatchObject({ score: 50, passed: false });
  });

  it("no permite evaluación sin puntaje mínimo; la asistencia manual queda marcada", async () => {
    const t = await mk();
    const wid = await person(t, "333333333");
    const course = await saveCourse(t, "u", { name: "Sin puntaje", kind: "other" });
    await expect(
      setQuestions(t, "u", course, [
        { question: "¿Pregunta?", options: ["a", "b"], correctIndex: 0 },
      ]),
    ).rejects.toThrow(/puntaje mínimo/);
    const s = await createSession(t, "u", { courseId: course, date: "2026-10-03" });
    await registerManualAttendance(t, "capacitador", s, wid);
    await expect(registerManualAttendance(t, "capacitador", s, wid)).rejects.toThrow(/ya tiene/);
    expect((await getSession(t, s))!.attendees[0]).toMatchObject({
      method: "manual",
      registeredBy: "capacitador",
      hasSignature: false,
    });
  });

  it("matriz de competencias por cargo: pendiente, cumple y vencido", async () => {
    const t = await mk();
    const ana = await person(t, "444444444", "Soldador");
    await person(t, "555555555", "Soldador");
    await person(t, "666666666", "Administrativo");
    const course = await saveCourse(t, "u", {
      name: "Trabajo en caliente",
      kind: "specific",
      validityMonths: "12",
    });
    await setRequirement(t, "u", "soldador", course, true);
    const old = await createSession(t, "u", { courseId: course, date: "2024-01-15" });
    await registerManualAttendance(t, "u", old, ana);
    const m = await competenceMatrix(t);
    expect(m.rows.map((r) => r.name).sort()).toEqual(["Persona 444444444", "Persona 555555555"]);
    expect(m.rows.find((r) => r.workerId === ana)!.items[0].state).toBe("vencido");
    expect(m.rows.find((r) => r.workerId !== ana)!.items[0].state).toBe("pendiente");
    const recent = await createSession(t, "u", {
      courseId: course,
      date: new Date().toISOString().slice(0, 10),
    });
    await registerManualAttendance(t, "u", recent, ana);
    expect((await competenceMatrix(t)).rows.find((r) => r.workerId === ana)!.items[0].state).toBe(
      "cumple",
    );
    await setRequirement(t, "u", "Soldador", course, false);
    expect((await competenceMatrix(t)).rows).toHaveLength(0);
  });

  it("certificado solo si aprobó; aislado por empresa", async () => {
    const a = await mk();
    const b = await mk();
    const wid = await person(a, "777777777");
    const course = await saveCourse(a, "u", { name: "Curso", kind: "specific" });
    const s = await createSession(a, "u", { courseId: course, date: "2026-10-04" });
    await registerManualAttendance(a, "u", s, wid, true);
    const att = (await getSession(a, s))!.attendees[0];
    expect((await certificateData(a, att.id))?.name).toBe("Persona 777777777");
    expect(await certificateData(b, att.id)).toBeNull();
  });
});
