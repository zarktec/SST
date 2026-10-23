import { describe, expect, it } from "vitest";
import {
  addYears,
  classifyStandards,
  companyDataSchema,
  effectiveRiskClass,
  evaluateResponsible,
  type SizeRiskRule,
} from "./rules";

const RULES: SizeRiskRule[] = [
  { group: 60, priority: 1, minWorkers: null, maxWorkers: null, riskClasses: [4, 5] },
  { group: 60, priority: 2, minWorkers: 51, maxWorkers: null, riskClasses: [1, 2, 3, 4, 5] },
  { group: 21, priority: 3, minWorkers: 11, maxWorkers: 50, riskClasses: [1, 2, 3] },
  { group: 7, priority: 4, minWorkers: 1, maxWorkers: 10, riskClasses: [1, 2, 3] },
];

describe("clasificación de estándares (7/21/60)", () => {
  it.each([
    [5, 1, 7],
    [10, 3, 7],
    [11, 1, 21],
    [50, 3, 21],
    [51, 1, 60],
    [3, 4, 60],
    [200, 5, 60],
  ])("%i trabajadores, riesgo %i → %i estándares", (workers, riskClass, group) =>
    expect(classifyStandards({ workers, riskClass }, RULES)).toBe(group),
  );
  it("sin trabajadores o sin regla aplicable no clasifica", () => {
    expect(classifyStandards({ workers: 0, riskClass: 1 }, RULES)).toBeNull();
    expect(classifyStandards({ workers: 5, riskClass: 1 }, [])).toBeNull();
  });
  it("la prioridad decide cuando varias reglas coinciden", () => {
    expect(classifyStandards({ workers: 5, riskClass: 5 }, [...RULES].reverse())).toBe(60);
  });
  it("la clase de riesgo efectiva es la más alta entre empresa y sedes", () => {
    expect(effectiveRiskClass(2, [1, 4, null])).toBe(4);
    expect(effectiveRiskClass(null, [])).toBeNull();
  });
});

describe("responsable del SG-SST", () => {
  const params = { refresherYears: 3, warnDays: 90 };
  const ok = {
    licenseNumber: "123",
    licenseValidUntil: "2030-01-01",
    course50hDate: "2025-06-01",
    refresher20hDate: null,
  };
  it("curso vigente: actualización a los 3 años", () => {
    const r = evaluateResponsible(ok, "2026-10-23", params);
    expect(r).toMatchObject({ ok: true, refresherDue: "2028-06-01", refresherState: "vigente" });
  });
  it("por vencer, vencida y sin datos", () => {
    expect(
      evaluateResponsible({ ...ok, course50hDate: "2023-12-01" }, "2026-10-23", params)
        .refresherState,
    ).toBe("por_vencer");
    const v = evaluateResponsible({ ...ok, course50hDate: "2020-01-01" }, "2026-10-23", params);
    expect(v.refresherState).toBe("vencida");
    expect(v.issues).toContain("La actualización de 20 horas está vencida");
    expect(
      evaluateResponsible({ ...ok, course50hDate: null }, "2026-10-23", params).refresherState,
    ).toBe("sin_datos");
  });
  it("la actualización realizada reinicia el conteo", () => {
    expect(
      evaluateResponsible(
        { ...ok, course50hDate: "2020-01-01", refresher20hDate: "2026-01-01" },
        "2026-10-23",
        params,
      ).refresherDue,
    ).toBe("2029-01-01");
  });
  it("licencia faltante o vencida", () => {
    expect(evaluateResponsible({ ...ok, licenseNumber: null }, "2026-10-23", params).ok).toBe(
      false,
    );
    expect(
      evaluateResponsible({ ...ok, licenseValidUntil: "2026-01-01" }, "2026-10-23", params).issues,
    ).toContain("La licencia en SST está vencida");
  });
  it("29 de febrero + años no desborda a marzo", () => {
    expect(addYears("2024-02-29", 3)).toBe("2027-02-28");
    expect(addYears("2024-02-29", 4)).toBe("2028-02-29");
  });
});

describe("datos de la empresa", () => {
  const valid = {
    nit: "900123456",
    nitDv: "8",
    legalName: "ACME SAS",
    tradeName: "ACME",
    ciiu: "4711",
    riskClass: "1",
    arl: "Sura",
    legalRepresentative: "Ana Pérez",
    workersCount: "12",
  };
  it("acepta y convierte números", () => {
    expect(companyDataSchema.parse(valid)).toMatchObject({ riskClass: 1, workersCount: 12 });
  });
  it("rechaza DV incorrecto, CIIU y clase de riesgo inválidos", () => {
    expect(companyDataSchema.safeParse({ ...valid, nitDv: "1" }).success).toBe(false);
    expect(companyDataSchema.safeParse({ ...valid, ciiu: "47" }).success).toBe(false);
    expect(companyDataSchema.safeParse({ ...valid, riskClass: "6" }).success).toBe(false);
  });
});
