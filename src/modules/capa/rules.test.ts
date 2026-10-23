import { describe, expect, it } from "vitest";
import { actionSchema, canMove, daysOverdue, escalationLevel, verifySchema } from "./rules";

describe("CAPA", () => {
  it("flujo de estados", () => {
    expect(canMove("open", "in_progress")).toBe(true);
    expect(canMove("open", "verified")).toBe(false);
    expect(canMove("done", "verified")).toBe(true);
    expect(canMove("verified", "open")).toBe(false);
    expect(canMove("cancelled", "open")).toBe(false);
  });
  it("mora solo de acciones abiertas o en curso", () => {
    expect(daysOverdue({ status: "open", dueDate: "2026-10-01" }, "2026-10-23")).toBe(22);
    expect(daysOverdue({ status: "open", dueDate: "2026-11-01" }, "2026-10-23")).toBe(0);
    expect(daysOverdue({ status: "done", dueDate: "2026-10-01" }, "2026-10-23")).toBe(0);
  });
  it("niveles de escalamiento", () => {
    const d = { level1: 1, level2: 15, level3: 30 };
    expect([0, 1, 14, 15, 29, 30, 90].map((n) => escalationLevel(n, d))).toEqual([
      0, 1, 1, 2, 2, 3, 3,
    ]);
  });
  it("validaciones", () => {
    expect(
      actionSchema.safeParse({
        type: "corrective",
        title: "Reparar baranda",
        responsibleName: "Luis",
        dueDate: "2026-11-01",
      }).success,
    ).toBe(true);
    expect(
      actionSchema.safeParse({
        type: "corrective",
        title: "ab",
        responsibleName: "L",
        dueDate: "x",
      }).success,
    ).toBe(false);
    expect(verifySchema.safeParse({ effective: "yes", note: "ok" }).success).toBe(false);
  });
});
