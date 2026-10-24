import { describe, expect, it } from "vitest";
import { inviteSchema, leavesNoAdmin } from "./rules";

const m = (id: string, roleKey: string, status = "active") => ({ id, roleKey, status });

describe("leavesNoAdmin", () => {
  const team = [m("a", "ADMIN_EMPRESA"), m("b", "TRABAJADOR")];
  it("no permite quitar, desactivar ni degradar al último administrador", () => {
    expect(leavesNoAdmin(team, { memberId: "a", newStatus: "disabled" })).toBe(true);
    expect(leavesNoAdmin(team, { memberId: "a", newRoleKey: "TRABAJADOR" })).toBe(true);
  });
  it("permite el cambio si queda otro administrador activo", () => {
    const two = [...team, m("c", "ADMIN_EMPRESA")];
    expect(leavesNoAdmin(two, { memberId: "a", newStatus: "disabled" })).toBe(false);
    expect(leavesNoAdmin(team, { memberId: "b", newRoleKey: "ADMIN_EMPRESA" })).toBe(false);
  });
  it("un administrador desactivado no cuenta", () => {
    const t = [m("a", "ADMIN_EMPRESA", "disabled"), m("b", "ADMIN_EMPRESA")];
    expect(leavesNoAdmin(t, { memberId: "b", newStatus: "disabled" })).toBe(true);
  });
});

describe("inviteSchema", () => {
  const roleId = "0190f3a0-7c1a-7b2e-8a11-0123456789ab";
  it("normaliza el correo y exige rol UUID", () => {
    expect(inviteSchema.parse({ email: "  Ana@Empresa.CO ", roleId }).email).toBe("ana@empresa.co");
    expect(inviteSchema.safeParse({ email: "no-es-correo", roleId }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "a@b.co", roleId: "x" }).success).toBe(false);
  });
});
