import { describe, expect, it } from "vitest";
import { PREOP_ITEMS, crashSchema, pesvStats, vehicleDocs, vehicleSchema } from "./rules";

describe("PESV", () => {
  it("documentos del vehículo: SOAT obligatorio vigente, RTM vigente o exenta", () => {
    expect(
      vehicleDocs({ soatExpiresOn: "2026-12-31", rtmExpiresOn: null }, "2026-06-01", 30).ok,
    ).toBe(true);
    expect(vehicleDocs({ soatExpiresOn: null, rtmExpiresOn: null }, "2026-06-01", 30).ok).toBe(
      false,
    );
    expect(
      vehicleDocs({ soatExpiresOn: "2026-12-31", rtmExpiresOn: "2026-05-31" }, "2026-06-01", 30).ok,
    ).toBe(false);
    expect(
      vehicleDocs({ soatExpiresOn: "2026-06-15", rtmExpiresOn: "2026-12-31" }, "2026-06-01", 30),
    ).toMatchObject({
      soat: "por_vencer",
      ok: true,
    });
  });
  it("normaliza y valida la placa", () => {
    expect(vehicleSchema.parse({ plate: " abc123 ", kind: "car" }).plate).toBe("ABC123");
    expect(vehicleSchema.safeParse({ plate: "A-1", kind: "car" }).success).toBe(false);
  });
  it("conteos base del reporte anual", () => {
    const st = pesvStats(
      {
        vehicles: [
          { id: "v1", soatExpiresOn: "2027-01-01", rtmExpiresOn: null },
          { id: "v2", soatExpiresOn: "2020-01-01", rtmExpiresOn: null },
        ],
        drivers: [{ licenseExpiresOn: "2027-01-01" }, { licenseExpiresOn: "2020-01-01" }],
        preops: [
          { vehicleId: "v1", performedOn: "2026-05-20" },
          { vehicleId: "v2", performedOn: "2026-01-02" },
        ],
        crashes: [
          { occurredOn: "2026-03-01", injured: 1, fatalities: 0 },
          { occurredOn: "2025-03-01", injured: 5, fatalities: 1 },
        ],
      },
      2026,
      "2026-06-01",
    );
    expect(st).toEqual({
      vehicles: 2,
      vehiclesDocsOk: 1,
      drivers: 2,
      driversLicenseOk: 1,
      preopVehiclesLast30: 1,
      crashes: 1,
      injured: 1,
      fatalities: 0,
      crashesPerVehicle: 0.5,
    });
  });
  it("siniestro: valida campos y la lista preoperacional tiene ítems críticos", () => {
    expect(
      crashSchema.safeParse({
        driverName: "Luis",
        date: "2026-01-01",
        place: "Calle 80",
        description: "Choque leve",
      }).success,
    ).toBe(true);
    expect(
      crashSchema.safeParse({ driverName: "L", date: "x", place: "", description: "" }).success,
    ).toBe(false);
    expect(PREOP_ITEMS.some((i) => i.critical)).toBe(true);
  });
});
