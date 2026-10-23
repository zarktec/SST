import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, schema, withPlatform } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { PlanLimitError } from "@/core/plans/limits";
import type { WorkerInput } from "./rules";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import {
  contractorStatuses,
  createWorker,
  getWorker,
  importWorkers,
  listWorkers,
  recordSsCheck,
  retireWorker,
  updateWorker,
} from "./service";

pointToTestDb();

const w = (over: Partial<WorkerInput> = {}): WorkerInput => ({
  kind: "employee",
  idType: "13",
  idNumber: "1032456789",
  fullName: "Ana Pérez",
  startDate: "2024-03-01",
  ...over,
});
let n = 0;
const mk = (users: number | null = null) =>
  createTenantWithSubscription(`wk-${++n}`, { users }).then((t) => t.id);

describe.skipIf(!hasTestDb)("trabajadores y contratistas", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("crea, busca por documento (blind index) y descifra la ficha; el documento no queda en claro", async () => {
    const t = await mk();
    const id = await createWorker(t, "u", w());
    expect((await listWorkers(t, { q: "1032456789" })).map((x) => x.id)).toEqual([id]);
    expect(await listWorkers(t, { q: "9999999" })).toHaveLength(0);
    const rec = await getWorker(t, id);
    expect(rec).toMatchObject({ idNumber: "1032456789", idLast4: "6789" });
    const rows = await withPlatform(
      { actorId: "t", action: "t", tenantId: t, audit: false },
      (tx) => tx.select().from(schema.worker),
    );
    expect(JSON.stringify(rows.filter((r) => r.tenantId === t))).not.toContain("1032456789");
  });

  it("rechaza documento duplicado en la empresa pero lo permite en otra", async () => {
    const t = await mk();
    await createWorker(t, "u", w());
    await expect(createWorker(t, "u", w({ fullName: "Otra" }))).rejects.toThrow(/Ya existe/);
    await createWorker(await mk(), "u", w());
  });

  it("no ve ni modifica personas de otra empresa", async () => {
    const a = await mk();
    const b = await mk();
    const id = await createWorker(a, "u", w());
    expect(await getWorker(b, id)).toBeNull();
    await expect(updateWorker(b, "u", id, w())).rejects.toThrow(/no encontrada/);
    expect(await listWorkers(b)).toHaveLength(0);
  });

  it("retiro conserva el registro y libera cupo del plan; contratistas no cuentan", async () => {
    const t = await mk();
    const id = await createWorker(t, "u", w());
    await retireWorker(t, "u", id, "2025-01-01");
    expect((await listWorkers(t, { status: "retired" })).map((x) => x.id)).toEqual([id]);
    expect(await listWorkers(t, { status: "active" })).toHaveLength(0);
    await expect(retireWorker(t, "u", id, "2020-01-01")).rejects.toThrow(/anterior/);
  });

  it("carga masiva: importa válidas, omite duplicadas y reporta errores por fila", async () => {
    const t = await mk();
    await createWorker(t, "u", w({ idNumber: "52123456", fullName: "Ya Existe" }));
    const csv = [
      "vinculacion,tipo_documento,documento,nombre,fecha_ingreso,cargo",
      "Empleado,CC,1111111111,Uno Uno,01/02/2024,Operario",
      "Contratista,CC,2222222222,Dos Dos,2024-02-01,",
      "Empleado,CC,52123456,Ya Existe,2024-02-01,",
      "Empleado,CC,abc,Malo,2024-02-01,",
    ].join("\n");
    const r = await importWorkers(t, "u", csv);
    expect(r.imported).toBe(2);
    expect(r.skipped.map((s) => s.row)).toEqual([4]);
    expect(r.errors.map((e) => e.row)).toEqual([5]);
    expect(await listWorkers(t)).toHaveLength(3);
  });

  it("respeta el límite de trabajadores del plan (los contratistas no cuentan)", async () => {
    const t = await mk();
    // Se fuerza un límite de 1 trabajador en el plan de la empresa.
    const { systemDb } = await import("@/core/db");
    const { eq } = await import("drizzle-orm");
    const [s] = await systemDb()
      .select()
      .from(schema.subscription)
      .where(eq(schema.subscription.tenantId, t));
    await systemDb()
      .update(schema.plan)
      .set({ limits: { workers: 1, users: null, centers: null, storageMb: null } })
      .where(eq(schema.plan.id, s.planId));
    await createWorker(t, "u", w());
    await createWorker(
      t,
      "u",
      w({
        kind: "contractor",
        idNumber: "7777777",
        fullName: "Contra",
        contractType: "prestacion_servicios",
      }),
    );
    await expect(
      createWorker(t, "u", w({ idNumber: "8888888", fullName: "Segundo" })),
    ).rejects.toBeInstanceOf(PlanLimitError);
  });

  it("verificación mensual de seguridad social del contratista", async () => {
    const t = await mk();
    const id = await createWorker(
      t,
      "u",
      w({ kind: "contractor", fullName: "Contra", contractorCompany: "Obras SAS" }),
    );
    const [before] = await contractorStatuses(t);
    expect(["pendiente", "vencida"]).toContain(before.state);
    const period = before.duePeriod;
    await recordSsCheck(t, "u", id, { period, paid: true, note: "Planilla 123" });
    expect((await contractorStatuses(t))[0].state).toBe("al_dia");
    await recordSsCheck(t, "u", id, { period, paid: false });
    expect((await contractorStatuses(t))[0].state).not.toBe("al_dia");
    const emp = await createWorker(t, "u", w({ idNumber: "5555555", fullName: "Emp" }));
    await expect(recordSsCheck(t, "u", emp, { period, paid: true })).rejects.toThrow(
      /contratistas/,
    );
    await expect(recordSsCheck(t, "u", id, { period: "2026-13", paid: true })).rejects.toThrow(
      /Periodo/,
    );
  });
});
