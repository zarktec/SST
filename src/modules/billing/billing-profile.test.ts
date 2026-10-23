import { describe, expect, it } from "vitest";
import { billingProfileSchema, nitCheckDigit, type BillingProfileInput } from "./billing-profile";

const valid: BillingProfileInput = {
  personType: "Company",
  idType: "31",
  identification: "800197268",
  checkDigit: "4",
  legalName: "Dirección de Impuestos y Aduanas Nacionales",
  address: "Carrera 8 # 6C-38",
  stateCode: "11",
  cityCode: "11001",
  postalCode: "111711",
  phone: "(601) 607 9999",
  invoiceEmail: "Facturas@Empresa.co",
  fiscalResponsibilities: ["O-13"],
  vatResponsible: true,
};
const issues = (input: unknown) => {
  const r = billingProfileSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
};

describe("dígito de verificación del NIT (DIAN)", () => {
  it.each([
    ["800197268", 4],
    ["900123456", 8],
  ])("%s → %i", (nit, dv) => expect(nitCheckDigit(nit)).toBe(dv));
  it("rechaza no numéricos", () => {
    expect(() => nitCheckDigit("80019726A")).toThrow();
    expect(() => nitCheckDigit("")).toThrow();
  });
});

describe("datos de facturación", () => {
  it("acepta un perfil válido y normaliza teléfono y correo", () => {
    const r = billingProfileSchema.parse(valid);
    expect(r.phone).toBe("6016079999");
    expect(r.invoiceEmail).toBe("facturas@empresa.co");
  });
  it("NIT con dígito incorrecto: informa el correcto", () => {
    expect(issues({ ...valid, checkDigit: "5" })).toEqual([
      "checkDigit: Dígito de verificación incorrecto (para este NIT es 4)",
    ]);
  });
  it("NIT sin dígito de verificación", () => {
    expect(issues({ ...valid, checkDigit: "" })).toEqual([
      "checkDigit: El NIT requiere dígito de verificación",
    ]);
  });
  it("persona natural con cédula no necesita dígito", () => {
    expect(
      issues({
        ...valid,
        personType: "Person",
        idType: "13",
        identification: "1032456789",
        checkDigit: undefined,
        fiscalResponsibilities: ["R-99-PN"],
        vatResponsible: false,
      }),
    ).toEqual([]);
  });
  it("persona jurídica solo con NIT", () => {
    expect(issues({ ...valid, idType: "13" })).toEqual([
      "idType: Una persona jurídica se identifica con NIT",
    ]);
  });
  it("departamento y municipio DANE coherentes", () => {
    expect(issues({ ...valid, stateCode: "12" })).toContain(
      "stateCode: Departamento inválido (código DANE de 2 dígitos)",
    );
    expect(issues({ ...valid, cityCode: "05001" })).toEqual([
      "cityCode: El municipio no pertenece al departamento",
    ]);
    expect(issues({ ...valid, cityCode: "1100" })).toContain(
      "cityCode: Municipio inválido (código DANE de 5 dígitos)",
    );
  });
  it("correo de recepción, teléfono y responsabilidades son obligatorios y válidos", () => {
    expect(issues({ ...valid, invoiceEmail: "no-es-correo" })).toEqual([
      "invoiceEmail: Correo de recepción de factura electrónica inválido",
    ]);
    expect(issues({ ...valid, phone: "123" })).toEqual(["phone: Teléfono inválido"]);
    expect(issues({ ...valid, fiscalResponsibilities: [] })).toEqual([
      "fiscalResponsibilities: Selecciona al menos una responsabilidad fiscal",
    ]);
    expect(issues({ ...valid, fiscalResponsibilities: ["X-1"] }).length).toBe(1);
  });
});
