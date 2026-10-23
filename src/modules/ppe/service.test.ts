import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import { createWorker } from "@/modules/workers/service";
import {
  addStock,
  listDeliveries,
  listItems,
  ppeMatrix,
  registerDelivery,
  saveItem,
  setRequirement,
} from "./service";

pointToTestDb();
const sig = `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(400, 7)]).toString("base64")}`;
let n = 0;
const mk = () => createTenantWithSubscription(`pp-${++n}`).then((t) => t.id);
const person = (t: string, doc: string, position = "Soldador") =>
  createWorker(t, "u", {
    kind: "employee",
    idType: "13",
    idNumber: doc,
    fullName: `P ${doc}`,
    startDate: "2024-01-01",
    position,
  });
const today = new Date().toISOString().slice(0, 10);

describe.skipIf(!hasTestDb)("EPP", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("entrega con firma calcula la reposición y guarda la evidencia", async () => {
    const t = await mk();
    const w = await person(t, "111111111");
    const item = await saveItem(t, "u", { name: "Guantes", usefulLifeMonths: "6" });
    await registerDelivery(
      t,
      "u",
      { workerId: w, itemId: item, reason: "first", deliveredAt: "2026-08-31", signature: sig },
      { ip: "1.2.3.4", userAgent: "Chrome" },
    );
    const [d] = await listDeliveries(t);
    expect(d).toMatchObject({ itemName: "Guantes", dueDate: "2027-02-28", hasSignature: true });
    await expect(
      registerDelivery(t, "u", {
        workerId: w,
        itemId: item,
        reason: "first",
        deliveredAt: today,
        signature: "x",
      }),
    ).rejects.toThrow(/firma/);
  });

  it("exige talla cuando el elemento la requiere", async () => {
    const t = await mk();
    const w = await person(t, "222222222");
    const item = await saveItem(t, "u", { name: "Botas", requiresSize: "on" });
    await expect(
      registerDelivery(t, "u", {
        workerId: w,
        itemId: item,
        reason: "first",
        deliveredAt: today,
        signature: sig,
      }),
    ).rejects.toThrow(/talla/);
    await registerDelivery(t, "u", {
      workerId: w,
      itemId: item,
      reason: "first",
      deliveredAt: today,
      size: "42",
      signature: sig,
    });
  });

  it("inventario: descuenta, alerta en el mínimo y bloquea si no alcanza; sin inventario registrado no bloquea", async () => {
    const t = await mk();
    const w = await person(t, "333333333");
    const item = await saveItem(t, "u", { name: "Casco", minStock: "2" });
    const free = await saveItem(t, "u", { name: "Tapabocas" });
    await registerDelivery(t, "u", {
      workerId: w,
      itemId: free,
      quantity: 50,
      reason: "first",
      deliveredAt: today,
      signature: sig,
    }); // sin control de stock
    await addStock(t, "u", { itemId: item, quantity: 5, entryDate: today });
    await registerDelivery(t, "u", {
      workerId: w,
      itemId: item,
      quantity: 3,
      reason: "first",
      deliveredAt: today,
      signature: sig,
    });
    expect((await listItems(t)).find((i) => i.id === item)).toMatchObject({ stock: 2, low: true });
    await expect(
      registerDelivery(t, "u", {
        workerId: w,
        itemId: item,
        quantity: 3,
        reason: "replacement",
        deliveredAt: today,
        signature: sig,
      }),
    ).rejects.toThrow(/Inventario insuficiente/);
  });

  it("matriz por cargo: pendiente → vigente → vencido", async () => {
    const t = await mk();
    const ana = await person(t, "444444444");
    await person(t, "555555555", "Administrativo");
    const item = await saveItem(t, "u", { name: "Careta", usefulLifeMonths: "6" });
    await setRequirement(t, "u", "soldador", item, true);
    const m = await ppeMatrix(t);
    expect(m.rows).toHaveLength(1);
    expect(m.rows[0].items[0].state).toBe("pendiente");
    await registerDelivery(t, "u", {
      workerId: ana,
      itemId: item,
      reason: "first",
      deliveredAt: "2025-01-01",
      signature: sig,
    });
    expect((await ppeMatrix(t)).rows[0].items[0].state).toBe("vencido");
    await registerDelivery(t, "u", {
      workerId: ana,
      itemId: item,
      reason: "replacement",
      deliveredAt: today,
      signature: sig,
    });
    expect((await ppeMatrix(t)).rows[0].items[0].state).toBe("vigente");
    await setRequirement(t, "u", "SOLDADOR", item, false);
    expect((await ppeMatrix(t)).rows).toHaveLength(0);
  });

  it("aísla por empresa", async () => {
    const a = await mk();
    const b = await mk();
    const w = await person(a, "666666666");
    const item = await saveItem(a, "u", { name: "Gafas" });
    await expect(
      registerDelivery(b, "u", {
        workerId: w,
        itemId: item,
        reason: "first",
        deliveredAt: today,
        signature: sig,
      }),
    ).rejects.toThrow(/no encontrad/);
    expect(await listItems(b)).toHaveLength(0);
  });
});
