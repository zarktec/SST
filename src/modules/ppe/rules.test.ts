import { describe, expect, it } from "vitest";
import { deliveryHash, deliverySchema, dueDateOf, itemSchema, ppeState, stockOf } from "./rules";

describe("estado de EPP", () => {
  it("pendiente sin entregas; vigente sin vida útil", () => {
    expect(ppeState([], "2026-10-23")).toEqual({
      state: "pendiente",
      dueDate: null,
      lastDelivery: null,
    });
    expect(ppeState([{ deliveredAt: "2020-01-01", dueDate: null }], "2026-10-23").state).toBe(
      "vigente",
    );
  });
  it("por vencer dentro de la ventana, vencido y la última entrega manda", () => {
    expect(
      ppeState([{ deliveredAt: "2026-04-01", dueDate: "2026-11-01" }], "2026-10-23").state,
    ).toBe("por_vencer");
    expect(
      ppeState([{ deliveredAt: "2026-04-01", dueDate: "2026-12-30" }], "2026-10-23").state,
    ).toBe("vigente");
    expect(
      ppeState([{ deliveredAt: "2025-01-01", dueDate: "2025-07-01" }], "2026-10-23").state,
    ).toBe("vencido");
    expect(
      ppeState(
        [
          { deliveredAt: "2025-01-01", dueDate: "2025-07-01" },
          { deliveredAt: "2026-10-01", dueDate: "2027-04-01" },
        ],
        "2026-10-23",
      ),
    ).toMatchObject({ state: "vigente", lastDelivery: "2026-10-01" });
  });
  it("fecha de reposición con vida útil", () => {
    expect(dueDateOf("2026-08-31", 6)).toBe("2027-02-28");
    expect(dueDateOf("2026-08-31", null)).toBeNull();
  });
});

describe("inventario y validaciones", () => {
  it("stock y alerta de mínimo", () => {
    expect(stockOf(10, 4, 6)).toEqual({ stock: 6, low: true });
    expect(stockOf(10, 4, 5)).toEqual({ stock: 6, low: false });
    expect(stockOf(0, 0, 0).low).toBe(false);
  });
  it("esquemas convierten vacíos y checkbox", () => {
    expect(
      itemSchema.parse({ name: "Casco", usefulLifeMonths: "", requiresSize: "on", minStock: "5" }),
    ).toMatchObject({ usefulLifeMonths: null, requiresSize: true, minStock: 5 });
    expect(
      deliverySchema.safeParse({
        workerId: "x",
        itemId: "y",
        reason: "first",
        deliveredAt: "2026-01-01",
      }).success,
    ).toBe(false);
  });
  it("la huella cambia con la firma", () => {
    const e = {
      workerId: "w",
      itemId: "i",
      quantity: 1,
      deliveredAt: "2026-01-01",
      signedAt: "t",
      signature: "a",
      ip: null,
      userAgent: null,
    };
    expect(deliveryHash({ ...e, signature: "b" })).not.toBe(deliveryHash(e));
  });
});
