import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import { createWorker } from "@/modules/workers/service";
import {
  HighRiskError,
  addCertificate,
  authorizePermit,
  cancelPermit,
  closePermit,
  ensureDefaultTypes,
  listCertificates,
  listPermits,
  listTypes,
  permitBlockers,
  requestPermit,
} from "./service";

pointToTestDb();
const sig = `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(400, 7)]).toString("base64")}`;
let n = 0;
const mk = () => createTenantWithSubscription(`hr-${++n}`).then((t) => t.id);
const person = (t: string, name: string, i: number) =>
  createWorker(t, "u", {
    kind: "employee",
    idType: "13",
    idNumber: `${3000000 + n * 10 + i}`,
    fullName: name,
    startDate: "2024-01-01",
    position: "Operario",
  });
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

async function setup() {
  const t = await mk();
  await ensureDefaultTypes(t, "u");
  const type = (await listTypes(t)).find((x) => x.kind === "heights")!;
  const [w1, w2] = [await person(t, "Ana", 1), await person(t, "Luis", 2)];
  const answers = Object.fromEntries(type.checklist.map((c) => [c.id, "ok"]));
  const req = (over: Record<string, unknown> = {}) =>
    requestPermit(
      t,
      "req",
      "Solicitante",
      {
        typeId: type.id,
        place: "Fachada norte",
        description: "Pintura de la fachada con andamio",
        date: tomorrow,
        fromTime: "08:00",
        toTime: "14:00",
        coordinatorWorkerId: w2,
        rescuePlan: "Rescate con la brigada",
        ...over,
      },
      { answers, workerIds: [w1], signature: sig },
    );
  return { t, type, w1, w2, req };
}

describe.skipIf(!hasTestDb)("tareas de alto riesgo", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("los tipos predeterminados se crean una sola vez", async () => {
    const t = await mk();
    await ensureDefaultTypes(t, "u");
    await ensureDefaultTypes(t, "u");
    expect(await listTypes(t)).toHaveLength(4);
  });

  it("alturas: no se autoriza sin certificados; con ellos, autoriza otra persona y se cierra", async () => {
    const { t, w1, w2, req } = await setup();
    const id = await req();
    expect(await permitBlockers(t, id)).toEqual([
      "Ana no tiene certificado de alturas vigente",
      "El coordinador no tiene certificado de coordinador vigente",
    ]);
    await expect(authorizePermit(t, "aut", "Autorizador", id, sig)).rejects.toThrow("certificado");
    const cert = (workerId: string, level: string, expiresOn: string) =>
      addCertificate(t, "u", {
        workerId,
        level,
        issuer: "SENA",
        issuedOn: "2020-01-01",
        expiresOn,
      });
    await cert(w1, "authorized", "2020-12-31");
    expect(await permitBlockers(t, id)).toContain("Ana no tiene certificado de alturas vigente");
    await cert(w1, "authorized", "2999-01-01");
    await cert(w2, "coordinator", "2999-01-01");
    expect(await permitBlockers(t, id)).toEqual([]);
    await expect(authorizePermit(t, "req", "Solicitante", id, sig)).rejects.toThrow(
      "no puede autorizarlo",
    );
    await authorizePermit(t, "aut", "Autorizador", id, sig);
    const [p] = await listPermits(t);
    expect(p).toMatchObject({
      status: "authorized",
      state: "programado",
      authorizedName: "Autorizador",
    });
    expect(p.requesterEvidence).toMatch(/^[0-9a-f]{64}$/);
    expect(p.authorizerEvidence).toMatch(/^[0-9a-f]{64}$/);
    await closePermit(t, "u", id, "Trabajo terminado sin novedad");
    expect((await listPermits(t))[0].state).toBe("cerrado");
    await expect(authorizePermit(t, "aut", "A", id, sig)).rejects.toBeInstanceOf(HighRiskError);
  });

  it("valida firma, horario y cancelación", async () => {
    const { t, type, w1, req } = await setup();
    await expect(req({ toTime: "07:00" })).rejects.toThrow("hora final");
    await expect(
      requestPermit(
        t,
        "req",
        "S",
        {
          typeId: type.id,
          place: "X1",
          description: "Descripción larga",
          date: tomorrow,
          fromTime: "08:00",
          toTime: "09:00",
        },
        { answers: {}, workerIds: [w1], signature: "no" },
      ),
    ).rejects.toThrow("firma");
    const id = await req();
    await expect(cancelPermit(t, "u", id, "no")).rejects.toThrow("motivo");
    await cancelPermit(t, "u", id, "Lluvia intensa");
    expect((await listPermits(t))[0].state).toBe("cancelado");
  });

  it("el último certificado por persona y nivel es el vigente; los anteriores son histórico", async () => {
    const { t, w1 } = await setup();
    await addCertificate(t, "u", {
      workerId: w1,
      level: "authorized",
      issuer: "SENA",
      issuedOn: "2024-01-01",
      expiresOn: "2025-01-01",
    });
    await addCertificate(t, "u", {
      workerId: w1,
      level: "authorized",
      issuer: "SENA",
      issuedOn: "2025-01-01",
      expiresOn: "2999-01-01",
    });
    const certs = await listCertificates(t);
    expect(certs.filter((c) => c.current)).toHaveLength(1);
    expect(certs.find((c) => c.current)!.state).toBe("vigente");
  });
});
