import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { closeDb, schema, withPlatform } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import { createWorker } from "@/modules/workers/service";
import {
  AccessDeniedError,
  advanceComplaint,
  cclMembership,
  conformCcl,
  getComplaint,
  getHarassmentReport,
  listComplaints,
  listHarassmentReports,
  signConfidentiality,
  submitComplaint,
  submitHarassmentReport,
  updateHarassmentReport,
} from "./service";

pointToTestDb();
const sig = `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(400, 7)]).toString("base64")}`;
const NARR = "El pasado lunes en la bodega me gritaron delante de mis compañeros.";
let n = 0;
const mk = () => createTenantWithSubscription(`cv-${++n}`).then((t) => t.id);
const person = (t: string, i: number, email?: string) =>
  createWorker(t, "u", {
    kind: "employee",
    idType: "13",
    idNumber: String(30_000_000 + i + n * 100),
    fullName: `Persona ${i}`,
    startDate: "2024-01-01",
    email: email ?? "",
  });
const actor = (email: string) => ({ userId: `user-${email}`, email });
const logs = (t: string) =>
  withPlatform({ actorId: "t", action: "t", tenantId: t, audit: false }, (tx) =>
    tx.select().from(schema.sensitiveAccessLog),
  );

async function cclWith(t: string) {
  const [e1, w1, e2, w2] = [
    await person(t, 1, "emp1@x.co"),
    await person(t, 2, "trab1@x.co"),
    await person(t, 3, "emp2@x.co"),
    await person(t, 4, "trab2@x.co"),
  ];
  await conformCcl(t, "u", {
    periodStart: "2026-01-15",
    members: [
      { workerId: e1, representation: "employer", seat: "principal" },
      { workerId: w1, representation: "workers", seat: "principal" },
      { workerId: e2, representation: "employer", seat: "alternate" },
      { workerId: w2, representation: "workers", seat: "alternate" },
    ],
  });
  return { e1, w1, e2, w2 };
}

describe.skipIf(!hasTestDb)("convivencia laboral y acoso sexual", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("el CCL exige tamaño mínimo por parte", async () => {
    const t = await mk();
    const [a, b] = [await person(t, 1), await person(t, 2)];
    await expect(
      conformCcl(t, "u", {
        periodStart: "2026-01-15",
        members: [
          { workerId: a, representation: "employer", seat: "principal" },
          { workerId: b, representation: "workers", seat: "principal" },
        ],
      }),
    ).rejects.toThrow(/suplente/);
  });

  it("no permite integrar el comité a quien tuvo una queja en el último año", async () => {
    const t = await mk();
    const [e1, w1, e2, w2] = [
      await person(t, 1),
      await person(t, 2),
      await person(t, 3),
      await person(t, 4),
    ];
    await submitComplaint(t, null, { narrative: NARR, respondentWorkerId: w1 });
    await expect(
      conformCcl(t, "u", {
        periodStart: "2026-01-15",
        members: [
          { workerId: e1, representation: "employer", seat: "principal" },
          { workerId: w1, representation: "workers", seat: "principal" },
          { workerId: e2, representation: "employer", seat: "alternate" },
          { workerId: w2, representation: "workers", seat: "alternate" },
        ],
      }),
    ).rejects.toThrow(/Persona 2/);
  });

  it("solo miembros activos que firmaron la confidencialidad ven las quejas; todo acceso queda registrado", async () => {
    const t = await mk();
    await cclWith(t);
    const { id } = await submitComplaint(t, "empleado@x.co", { narrative: NARR });
    await expect(listComplaints(t, actor("empleado@x.co"))).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    await expect(listComplaints(t, actor("trab1@x.co"))).rejects.toThrow(/confidencialidad/);
    await signConfidentiality(t, actor("trab1@x.co"), sig);
    expect((await cclMembership(t, "trab1@x.co"))?.memberships[0].confidentialityAt).toBeTruthy();
    expect((await listComplaints(t, actor("trab1@x.co")))[0]).not.toHaveProperty(
      "narrativeEncrypted",
    );
    const d = (await getComplaint(t, actor("trab1@x.co"), id))!;
    expect(d.complaint.narrative).toBe(NARR);
    const entries = await logs(t);
    expect(entries.map((e) => e.reason)).toEqual(expect.arrayContaining(["listado", "lectura"]));
    expect(entries.every((e) => e.actorId === "user-trab1@x.co")).toBe(true);
    await expect(signConfidentiality(t, actor("intruso@x.co"), sig)).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
  });

  it("el relato nunca se guarda en claro y la queja anónima no guarda quién la hizo", async () => {
    const t = await mk();
    await cclWith(t);
    await person(t, 9, "quejoso@x.co");
    await submitComplaint(t, "quejoso@x.co", { narrative: NARR, anonymous: true });
    await submitComplaint(t, "quejoso@x.co", { narrative: NARR });
    const rows = await withPlatform(
      { actorId: "t", action: "t", tenantId: t, audit: false },
      (tx) => tx.select().from(schema.cclComplaint),
    );
    const mine = rows.filter((r) => r.tenantId === t);
    expect(JSON.stringify(mine)).not.toContain("bodega");
    expect(mine.filter((r) => r.complainantWorkerId === null)).toHaveLength(1);
    expect(mine.filter((r) => r.complainantWorkerId !== null)).toHaveLength(1);
  });

  it("trámite: transiciones válidas, plazos, nota obligatoria, historial cifrado y cierre final", async () => {
    const t = await mk();
    await cclWith(t);
    await signConfidentiality(t, actor("emp1@x.co"), sig);
    const { id } = await submitComplaint(t, null, { narrative: NARR });
    const a = actor("emp1@x.co");
    await expect(advanceComplaint(t, a, id, "agreement", "intento saltar")).rejects.toThrow(
      /no es válido/,
    );
    await expect(advanceComplaint(t, a, id, "summoned", " ")).rejects.toThrow(/nota/);
    await advanceComplaint(t, a, id, "summoned", "Se citó a las partes para el viernes");
    let d = (await getComplaint(t, a, id))!;
    expect(d.complaint.stage).toBe("summoned");
    expect(d.complaint.stageDueAt).toBeTruthy();
    await advanceComplaint(t, a, id, "hearing", "Reunión realizada con ambas partes");
    await advanceComplaint(t, a, id, "agreement", "Acuerdo de respeto mutuo");
    await advanceComplaint(t, a, id, "closed", "Cierre por acuerdo cumplido");
    d = (await getComplaint(t, a, id))!;
    expect(d.complaint.closedAt).toBeTruthy();
    expect(d.next).toEqual([]);
    expect(d.events.map((e) => e.stage)).toEqual([
      "received",
      "summoned",
      "hearing",
      "agreement",
      "closed",
    ]);
    expect(d.events[1].note).toContain("Se citó");
    await expect(advanceComplaint(t, a, id, "follow_up", "ya cerrada")).rejects.toThrow(
      /no es válido/,
    );
    const raw = await withPlatform({ actorId: "t", action: "t", tenantId: t, audit: false }, (tx) =>
      tx.execute(sql`select note_encrypted from ccl_complaint_event where tenant_id = ${t}`),
    );
    expect(JSON.stringify(raw.rows)).not.toContain("citó");
  });

  it("aísla por empresa", async () => {
    const a = await mk();
    const b = await mk();
    await cclWith(a);
    await cclWith(b);
    await signConfidentiality(a, actor("emp1@x.co"), sig);
    await signConfidentiality(b, actor("emp1@x.co"), sig);
    const { id } = await submitComplaint(a, null, { narrative: NARR });
    expect(await getComplaint(b, actor("emp1@x.co"), id)).toBeNull();
    await expect(
      advanceComplaint(b, actor("emp1@x.co"), id, "summoned", "nota válida"),
    ).rejects.toThrow(/no encontrada/);
  });

  it("acoso sexual: canal aparte, relato cifrado, accesos registrados, no depende del CCL", async () => {
    const t = await mk();
    await cclWith(t);
    const id = await submitHarassmentReport(t, "x@x.co", {
      narrative: "Un superior me hizo comentarios inapropiados repetidamente.",
    });
    const dir = actor("gerencia@x.co");
    expect((await listHarassmentReports(t, dir))[0]).not.toHaveProperty("narrativeEncrypted");
    expect((await getHarassmentReport(t, dir, id))!.narrative).toContain(
      "comentarios inapropiados",
    );
    await updateHarassmentReport(t, dir, id, "referred", "Remitido a la autoridad competente");
    expect((await getHarassmentReport(t, dir, id))!.note).toContain("Remitido");
    const raw = await withPlatform({ actorId: "t", action: "t", tenantId: t, audit: false }, (tx) =>
      tx.execute(sql`select narrative_encrypted from harassment_report where tenant_id = ${t}`),
    );
    expect(JSON.stringify(raw.rows)).not.toContain("inapropiados");
    expect(
      (await logs(t)).filter((l) => l.entity === "harassment_report").length,
    ).toBeGreaterThanOrEqual(4);
    // Un miembro del CCL no tiene acceso a las quejas de ese canal por permisos: el módulo `harassment` no está en su rol.
    const { defaultPermissions } = await import("@/core/rbac/roles");
    expect(defaultPermissions("MIEMBRO_CCL").some((p) => p.module === "harassment")).toBe(false);
    expect(
      defaultPermissions("ALTA_DIRECCION").some(
        (p) => p.module === "harassment" && p.action === "view",
      ),
    ).toBe(true);
  });
});
