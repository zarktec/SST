import { describe, expect, it } from "vitest";
import { normalizeDate, parseWorkerRows, previousPeriod, ssState, workerSchema } from "./rules";

const base = {
  kind: "employee",
  idType: "13",
  idNumber: "1032456789",
  fullName: "Ana Pérez",
  startDate: "2024-03-01",
};

describe("trabajador", () => {
  it("acepta datos mínimos y normaliza opcionales", () => {
    const w = workerSchema.parse({ ...base, email: "ANA@X.CO", phone: "", arlRiskClass: "3" });
    expect(w).toMatchObject({ email: "ana@x.co", phone: null, arlRiskClass: 3, endDate: null });
  });
  it("rechaza retiro anterior al ingreso, documento y fecha inválidos", () => {
    expect(workerSchema.safeParse({ ...base, endDate: "2023-01-01" }).success).toBe(false);
    expect(workerSchema.safeParse({ ...base, idNumber: "12A" }).success).toBe(false);
    expect(workerSchema.safeParse({ ...base, startDate: "" }).success).toBe(false);
  });
  it("fechas en formato Excel", () => {
    expect(normalizeDate("5/3/2024")).toBe("2024-03-05");
    expect(normalizeDate("31/02/2024")).toBeNull();
    expect(normalizeDate("2024-13-01")).toBeNull();
  });
});

describe("carga masiva", () => {
  const centers = new Map([["sede principal", "00000000-0000-7000-8000-000000000001"]]);
  const head = ["vinculacion", "tipo_documento", "documento", "nombre", "fecha_ingreso", "sede"];
  it("separa válidas y erróneas con número de fila, acepta alias", () => {
    const r = parseWorkerRows(
      [
        head,
        ["Empleado", "CC", "1032456789", "Ana Pérez", "01/03/2024", "Sede Principal"],
        ["Contratista", "CE", "99999", "Luis", "2024-01-01", "Otra"],
        ["Aprendiz", "CC", "1032456789", "Repetida", "2024-01-01", ""],
        ["Empleado", "CC", "12", "Corto", "2024-01-01", ""],
      ],
      centers,
    );
    expect(r.valid.map((v) => v.row)).toEqual([2]);
    expect(r.valid[0].data).toMatchObject({
      kind: "employee",
      idType: "13",
      startDate: "2024-03-01",
    });
    expect(r.errors.map((e) => e.row)).toEqual([3, 4, 5]);
    expect(r.errors[0].message).toMatch(/Sede no encontrada/);
    expect(r.errors[1].message).toMatch(/repetido/);
  });
  it("encabezados desconocidos o faltantes detienen la carga", () => {
    expect(parseWorkerRows([["foo"], ["x"]], centers).errors[0].message).toMatch(/no reconocidas/);
    expect(parseWorkerRows([["nombre"], ["x"]], centers).errors[0].message).toMatch(/Faltan/);
    expect(parseWorkerRows([head], centers).errors[0].message).toMatch(/no tiene filas/);
  });
});

describe("seguridad social de contratistas", () => {
  it("periodo anterior, incluso en enero", () => {
    expect(previousPeriod("2026-10-23")).toBe("2026-09");
    expect(previousPeriod("2026-01-05")).toBe("2025-12");
  });
  it("al día, pendiente antes del día límite y vencida después", () => {
    expect(ssState([{ period: "2026-09", paid: true }], "2026-10-23", 10)).toBe("al_dia");
    expect(ssState([], "2026-10-05", 10)).toBe("pendiente");
    expect(ssState([{ period: "2026-09", paid: false }], "2026-10-23", 10)).toBe("vencida");
    expect(ssState([{ period: "2026-08", paid: true }], "2026-10-23", 10)).toBe("vencida");
  });
});
