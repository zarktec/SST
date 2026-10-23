import { describe, expect, it } from "vitest";
import { defaultPermissions, SYSTEM_ROLES } from "./roles";

const can = (role: Parameters<typeof defaultPermissions>[0], module: string, action: string) =>
  defaultPermissions(role).some((p) => p.module === module && p.action === action);

describe("permisos por defecto", () => {
  it("todos los roles de sistema tienen al menos un permiso", () => {
    for (const r of SYSTEM_ROLES) expect(defaultPermissions(r.key).length).toBeGreaterThan(0);
  });
  it("solo el miembro del CCL accede a quejas de convivencia", () => {
    for (const r of SYSTEM_ROLES) {
      expect(can(r.key, "ccl", "view")).toBe(r.key === "MIEMBRO_CCL");
    }
  });
  it("el CCL nunca recibe quejas de acoso sexual; las ve la alta dirección", () => {
    expect(can("MIEMBRO_CCL", "harassment", "view")).toBe(false);
    expect(can("ALTA_DIRECCION", "harassment", "view")).toBe(true);
    expect(can("RESPONSABLE_SST", "harassment", "view")).toBe(false);
  });
  it("el auditor externo es solo lectura y no ve información médica", () => {
    const perms = defaultPermissions("AUDITOR_EXTERNO");
    expect(perms.every((p) => p.action === "view" || p.action === "export")).toBe(true);
    expect(can("AUDITOR_EXTERNO", "medical", "view")).toBe(false);
  });
  it("solo ADMIN_EMPRESA gestiona facturación y usuarios", () => {
    for (const r of SYSTEM_ROLES) {
      expect(can(r.key, "billing", "edit")).toBe(r.key === "ADMIN_EMPRESA");
    }
  });
});
