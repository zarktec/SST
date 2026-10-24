import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { listActions } from "@/modules/capa/service";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import { createWorker } from "@/modules/workers/service";
import {
  PesvError,
  annualStats,
  listDrivers,
  listPreops,
  listVehicles,
  registerCrash,
  saveDriver,
  saveVehicle,
  submitPreop,
} from "./service";

pointToTestDb();
let n = 0;
const mk = (modules: string[] = ["pesv"]) =>
  createTenantWithSubscription(`pv-${++n}`, { modules }).then((t) => t.id);
const today = new Date().toISOString().slice(0, 10);

describe.skipIf(!hasTestDb)("PESV", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("es un módulo opcional por plan", async () => {
    const t = await mk([]);
    await expect(saveVehicle(t, "u", { plate: "ABC123", kind: "car" })).rejects.toMatchObject({
      code: "MODULE_DISABLED",
    });
  });

  it("vehículos: placa única entre activos y estado de documentos", async () => {
    const t = await mk();
    await saveVehicle(t, "u", { plate: "abc123", kind: "car", soatExpiresOn: "2020-01-01" });
    await expect(saveVehicle(t, "u", { plate: "ABC123", kind: "truck" })).rejects.toThrow(
      "esa placa",
    );
    const [v] = await listVehicles(t);
    expect(v.docs).toMatchObject({ soat: "vencido", ok: false });
  });

  it("conductor: registrar de nuevo actualiza la licencia en vez de duplicar", async () => {
    const t = await mk();
    const w = await createWorker(t, "u", {
      kind: "employee",
      idType: "13",
      idNumber: `${4000000 + n}`,
      fullName: "Carlos Conductor",
      startDate: "2024-01-01",
      position: "Conductor",
    });
    await saveDriver(t, "u", {
      workerId: w,
      licenseCategory: "C1",
      licenseExpiresOn: "2020-01-01",
    });
    await saveDriver(t, "u", {
      workerId: w,
      licenseCategory: "C2",
      licenseExpiresOn: "2999-01-01",
    });
    const d = await listDrivers(t);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ licenseCategory: "C2", license: "vigente" });
  });

  it("preoperacional: la falla crítica crea una acción (una vez por día e ítem); sin descripción se rechaza", async () => {
    const t = await mk();
    const v = await saveVehicle(t, "u", { plate: "XYZ987", kind: "motorcycle" });
    await expect(
      submitPreop(t, "u", "Luis", { vehicleId: v }, { Frenos: "" }),
    ).rejects.toBeInstanceOf(PesvError);
    const r = await submitPreop(
      t,
      "u",
      "Luis",
      { vehicleId: v, odometer: "12000" },
      { Frenos: "Pedal blando", "Espejos y vidrios": "Espejo roto" },
    );
    expect(r).toEqual({ failCount: 2, criticalFailures: 1 });
    await submitPreop(t, "u", "Luis", { vehicleId: v }, { Frenos: "Pedal blando" });
    expect(
      (await listActions(t, { status: "all" })).filter((a) => a.source === "inspection"),
    ).toHaveLength(1);
    expect(await listPreops(t)).toHaveLength(2);
  });

  it("siniestros y datos del reporte anual", async () => {
    const t = await mk();
    const v = await saveVehicle(t, "u", {
      plate: "QWE456",
      kind: "car",
      soatExpiresOn: "2999-01-01",
    });
    await registerCrash(t, "u", {
      vehicleId: v,
      driverName: "Luis",
      date: today,
      place: "Autopista Norte",
      description: "Colisión por alcance",
      injured: "2",
    });
    await expect(
      registerCrash(t, "u", {
        driverName: "Luis",
        date: "2999-01-01",
        place: "Calle 1",
        description: "Futuro imposible",
      }),
    ).rejects.toBeInstanceOf(PesvError);
    const s = await annualStats(t, Number(today.slice(0, 4)));
    expect(s).toMatchObject({
      vehicles: 1,
      vehiclesDocsOk: 1,
      crashes: 1,
      injured: 2,
      crashesPerVehicle: 1,
    });
  });
});
