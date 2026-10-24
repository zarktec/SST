import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { seedHolidays } from "@/core/calendar/service";
import { listActions } from "@/modules/capa/service";
import { reportIncident } from "@/modules/incidents/service";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import {
  AuditError,
  auditProgram,
  buildReviewInputs,
  closeAudit,
  createAudit,
  createReview,
  listAudits,
  listReviews,
  refreshReviewInputs,
  saveAudit,
  saveReview,
  signReview,
} from "./service";
import { todayYmd } from "@/lib/dates";

pointToTestDb();
const sig = `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(400, 7)]).toString("base64")}`;
let n = 0;
const mk = () => createTenantWithSubscription(`au-${++n}`).then((t) => t.id);
const today = todayYmd();
const year = Number(today.slice(0, 4));

describe.skipIf(!hasTestDb)("auditoría interna y revisión por la dirección", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
    await seedHolidays([year - 1, year, year + 1]);
  });

  it("auditoría: no cierra incompleta; al cerrar crea una acción por hallazgo y observación", async () => {
    const t = await mk();
    const id = await createAudit(t, "u", {
      title: "Auditoría anual del SG-SST",
      plannedOn: today,
      itemsText: "Política divulgada\nActas del COPASST\nMatriz de peligros",
    });
    await expect(
      createAudit(t, "u", { title: "Sin ítems", plannedOn: today }),
    ).rejects.toBeInstanceOf(AuditError);
    await expect(closeAudit(t, "u", id)).rejects.toThrow("fecha de realización");
    const exec = {
      performedOn: today,
      auditorName: "Marta Díaz",
      committeeParticipant: "Luis Gómez",
      report: "Informe: el sistema cumple parcialmente los requisitos",
    };
    await saveAudit(t, "u", id, exec, {
      a1: { result: "conforms" },
      a2: { result: "major_nc", note: "Faltan tres actas" },
      a3: { result: "observation", note: "Actualizar peligros de la bodega" },
    });
    const r = await closeAudit(t, "u", id);
    expect(r.findings).toBe(2);
    const acts = (await listActions(t, { status: "all" })).filter((a) => a.source === "audit");
    expect(acts).toHaveLength(2);
    expect(acts.map((a) => a.type).sort()).toEqual(["corrective", "improvement"]);
    await expect(saveAudit(t, "u", id, exec, {})).rejects.toThrow("cerrada");
    expect(await auditProgram(t, year)).toMatchObject({ closed: 1, planned: 0 });
    expect((await listAudits(t))[0]).toMatchObject({ status: "closed", findings: 2 });
  });

  it("revisión: instantánea de entradas, edición en borrador y firma que congela y crea acciones", async () => {
    const t = await mk();
    await reportIncident(t, "u", {
      kind: "accident",
      occurredDate: today,
      affectedName: "Visitante",
      place: "Bodega",
      description: "Caída del mismo nivel",
      severity: "minor",
    });
    const inputs = await buildReviewInputs(t, year);
    expect(inputs.accidents).toEqual({ total: 1, fatal: 0, incidents: 0 });
    expect(inputs.indicators.length).toBeGreaterThan(0);
    const id = await createReview(t, "u", year, {
      heldOn: today,
      attendees: "Gerente general y responsable del SG-SST",
    });
    await expect(signReview(t, "dir", "Gerente", id, sig, {})).rejects.toThrow("conclusiones");
    await saveReview(t, "u", id, {
      heldOn: today,
      attendees: "Gerente general y responsable del SG-SST",
      conclusions: "El sistema es conveniente y adecuado pero requiere más recursos",
      decisions: "Asignar presupuesto para capacitación\nContratar un auditor externo",
    });
    await refreshReviewInputs(t, "u", id);
    await expect(signReview(t, "dir", "Gerente", id, "no", {})).rejects.toThrow("firma");
    await signReview(t, "dir", "Gerente", id, sig, { name: "Marta" });
    const [r] = await listReviews(t);
    expect(r).toMatchObject({ status: "signed", signedName: "Gerente" });
    expect(r.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(
      (await listActions(t, { status: "all" })).filter((a) => a.source === "management_review"),
    ).toHaveLength(2);
    await expect(
      saveReview(t, "u", id, {
        heldOn: today,
        attendees: "Otros asistentes",
        conclusions: "Cambio",
      }),
    ).rejects.toThrow("firmada");
    await expect(refreshReviewInputs(t, "u", id)).rejects.toThrow("firmada");
    await expect(signReview(t, "dir", "Gerente", id, sig, {})).rejects.toThrow("ya está firmada");
  });
});
