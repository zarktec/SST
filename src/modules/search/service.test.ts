import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { createAction } from "@/modules/capa/service";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import { createWorker } from "@/modules/workers/service";
import { likePattern, searchAll } from "./service";

pointToTestDb();
let n = 0;
const mk = () => createTenantWithSubscription(`se-${++n}`).then((t) => t.id);
const view = (...m: string[]) => m.map((module) => ({ module, action: "view" }));

describe("búsqueda global", () => {
  it("escapa los comodines de LIKE", () => {
    expect(likePattern(" 100%_a\\b ")).toBe("%100\\%\\_a\\\\b%");
  });
});

describe.skipIf(!hasTestDb)("búsqueda global (BD)", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("busca sin distinguir mayúsculas, respeta permisos y aísla por empresa", async () => {
    const [a, b] = [await mk(), await mk()];
    await createAction(a, "u", {
      type: "corrective",
      title: "Reparar la BARANDA de la escalera",
      responsibleName: "Luis",
      dueDate: "2030-01-01",
    });
    await createAction(b, "u", {
      type: "corrective",
      title: "Baranda de la otra empresa",
      responsibleName: "Ana",
      dueDate: "2030-01-01",
    });
    await createWorker(a, "u", {
      kind: "employee",
      idType: "13",
      idNumber: `${7000000 + n}`,
      fullName: "Barbara Baranda",
      startDate: "2024-01-01",
      position: "Operario",
    });
    const all = await searchAll(a, "baranda", view("actions", "workers"));
    expect(all.map((h) => h.group).sort()).toEqual(["Acciones", "Personas"]);
    expect(all.find((h) => h.group === "Acciones")?.title).toContain("BARANDA");
    expect((await searchAll(a, "baranda", view("actions"))).map((h) => h.group)).toEqual([
      "Acciones",
    ]);
    expect(await searchAll(a, "baranda", view("incidents"))).toEqual([]);
    expect(await searchAll(a, "b", view("actions"))).toEqual([]); // mínimo 2 letras
    expect(await searchAll(a, "100%", view("actions", "workers"))).toEqual([]);
  });
});
