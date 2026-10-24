import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, schema, withPlatform } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { seedHolidays } from "@/core/calendar/service";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import { createWorker } from "@/modules/workers/service";
import {
  addDisease,
  addInvestigationAction,
  completeInvestigation,
  discloseLessons,
  furatData,
  getIncident,
  investigationActions,
  listDiseases,
  listIncidents,
  markReported,
  qualifyDisease,
  remitToArl,
  reportIncident,
  saveInvestigation,
  startInvestigation,
} from "./service";
import { todayYmd } from "@/lib/dates";

pointToTestDb();
let n = 0;
const mk = () => createTenantWithSubscription(`in-${++n}`).then((t) => t.id);
const person = (t: string, doc: string) =>
  createWorker(t, "u", {
    kind: "employee",
    idType: "13",
    idNumber: doc + n,
    fullName: `P ${doc}`,
    startDate: "2024-01-01",
    position: "Operario",
  });
const today = todayYmd();
const base = {
  kind: "accident" as const,
  occurredDate: today,
  place: "Bodega",
  description: "Se resbaló en el pasillo mojado",
  severity: "minor" as const,
};
const team = [
  { name: "Ana", role: "copasst" as const },
  { name: "Luis", role: "sst" as const },
  { name: "Marta", role: "boss" as const },
];
const logs = (t: string) =>
  withPlatform({ actorId: "t", action: "t", tenantId: t, audit: false }, (tx) =>
    tx.select().from(schema.sensitiveAccessLog),
  );

describe.skipIf(!hasTestDb)("accidentes, investigación y enfermedad laboral", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
    const y = new Date().getUTCFullYear();
    await seedHolidays([y - 1, y, y + 1]);
  });

  it("registra el evento con plazo de 2 días hábiles y el contador; reportar a la ARL lo marca como reportado", async () => {
    const t = await mk();
    const w = await person(t, "100000");
    const { id, arlDeadline } = await reportIncident(t, "u", { ...base, workerId: w });
    expect(arlDeadline).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(arlDeadline >= today).toBe(true);
    const [i] = await listIncidents(t);
    expect(i.report).toMatchObject({ state: expect.stringMatching(/en_plazo|vence_hoy/) });
    await markReported(t, "u", id, { arlReportedAt: today, reportNumber: "ARL-123" });
    expect((await listIncidents(t))[0].report?.state).toBe("reportado");
    await expect(markReported(t, "u", id, { arlReportedAt: "hoy" })).rejects.toThrow(/inválida/);
  });

  it("no acepta eventos futuros ni accidentes sin lesión; permite persona sin registrar", async () => {
    const t = await mk();
    await expect(
      reportIncident(t, "u", { ...base, affectedName: "Visitante", occurredDate: "2999-01-01" }),
    ).rejects.toThrow(/futuro/);
    await expect(
      reportIncident(t, "u", { ...base, affectedName: "Visitante", severity: "none" }),
    ).rejects.toThrow();
    const r = await reportIncident(t, "u", { ...base, affectedName: "Visitante" });
    expect((await getIncident(t, r.id))!.incident.person).toBe("Visitante");
  });

  it("investigación: plazo de 15 días, no cierra sin requisitos, acciones van a CAPA y cierra", async () => {
    const t = await mk();
    const w = await person(t, "200000");
    const { id } = await reportIncident(t, "u", { ...base, workerId: w });
    await startInvestigation(t, "u", id);
    await expect(startInvestigation(t, "u", id)).rejects.toThrow(/Ya hay/);
    const g = (await getIncident(t, id))!;
    expect(g.incident.status).toBe("investigating");
    expect(g.investigation!.deadline).toBe(
      new Date(Date.parse(today) + 15 * 86_400_000).toISOString().slice(0, 10),
    );
    await expect(completeInvestigation(t, "u", id)).rejects.toThrow(/COPASST/);
    await saveInvestigation(t, "u", id, {
      team,
      method: "five_whys",
      analysis: ["Se resbaló", "Piso mojado", "Sin señalización"],
      immediateCauses: "Piso mojado",
      basicCauses: "No hay procedimiento de limpieza",
    });
    await expect(completeInvestigation(t, "u", id)).rejects.toThrow(/acción/);
    await addInvestigationAction(t, "u", id, {
      title: "Señalizar el piso mojado durante la limpieza",
      responsibleName: "Marta",
      dueDate: "2026-12-01",
    });
    expect(await investigationActions(t, id)).toHaveLength(1);
    await completeInvestigation(t, "u", id);
    expect((await getIncident(t, id))!.incident.status).toBe("closed");
    await expect(
      saveInvestigation(t, "u", id, { team, method: "five_whys", analysis: ["a", "b", "c"] }),
    ).rejects.toThrow(/cerrada/);
    await discloseLessons(t, "u", id, "Señalizar siempre el piso mojado y limpiar por tramos.");
    expect((await getIncident(t, id))!.investigation!.lessonsDisclosedAt).toBeTruthy();
  });

  it("evento grave exige profesional con licencia y remisión a la ARL", async () => {
    const t = await mk();
    const w = await person(t, "300000");
    const { id } = await reportIncident(t, "u", { ...base, workerId: w, severity: "serious" });
    await startInvestigation(t, "u", id);
    await saveInvestigation(t, "u", id, {
      team,
      method: "cause_tree",
      analysis: [
        { id: "1", text: "Caída" },
        { id: "2", text: "Sin arnés" },
        { id: "3", text: "Sin capacitación" },
      ],
      immediateCauses: "Sin arnés",
      basicCauses: "Falta de capacitación",
    });
    await addInvestigationAction(t, "u", id, {
      title: "Capacitar en trabajo en alturas",
      responsibleName: "Luis",
      dueDate: "2026-12-01",
    });
    await expect(completeInvestigation(t, "u", id)).rejects.toThrow(/licencia/);
    await saveInvestigation(t, "u", id, {
      team: [...team, { name: "Dra. Pérez", role: "licensed" }],
      method: "cause_tree",
      analysis: [
        { id: "1", text: "Caída" },
        { id: "2", text: "Sin arnés" },
        { id: "3", text: "Sin capacitación" },
      ],
      immediateCauses: "Sin arnés",
      basicCauses: "Falta de capacitación",
    });
    await expect(completeInvestigation(t, "u", id)).rejects.toThrow(/remitirse a la ARL/);
    await remitToArl(t, "u", id, today);
    await completeInvestigation(t, "u", id);
  });

  it("FURAT precargado descifra el documento y deja registro de acceso", async () => {
    const t = await mk();
    const w = await person(t, "400000");
    const { id } = await reportIncident(t, "u", { ...base, workerId: w });
    const before = (await logs(t)).length;
    const f = (await furatData(t, "reader", id))!;
    expect(f.trabajador).toMatchObject({ nombre: "P 400000", documento: `400000${n}` });
    expect(f.evento).toMatchObject({ lugar: "Bodega", fecha: today });
    expect((await logs(t)).length).toBe(before + 1);
  });

  it("enfermedad laboral: caso, calificación y aislamiento", async () => {
    const a = await mk();
    const b = await mk();
    const w = await person(a, "500000");
    const id = await addDisease(a, "u", {
      workerId: w,
      diagnosis: "Hipoacusia neurosensorial",
      detectedOn: "2026-09-01",
      isNew: "on",
    });
    expect((await listDiseases(a))[0]).toMatchObject({ qualification: "pending", isNew: true });
    await expect(
      qualifyDisease(a, "u", id, {
        qualification: "occupational",
        qualifiedOn: "2026-10-01",
        qualifiedBy: " ",
      }),
    ).rejects.toThrow(/quién calificó/);
    await qualifyDisease(a, "u", id, {
      qualification: "occupational",
      qualifiedOn: "2026-10-01",
      qualifiedBy: "Junta regional",
    });
    expect((await listDiseases(a))[0].qualification).toBe("occupational");
    expect(await listDiseases(b)).toHaveLength(0);
    await expect(
      qualifyDisease(b, "u", id, {
        qualification: "common",
        qualifiedOn: "2026-10-01",
        qualifiedBy: "EPS",
      }),
    ).rejects.toThrow(/no encontrado/);
    expect(await listIncidents(b)).toHaveLength(0);
  });
});
