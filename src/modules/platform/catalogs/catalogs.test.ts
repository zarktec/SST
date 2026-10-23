import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { closeDb, schema, systemDb } from "@/core/db";
import { dbErrorMessage, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { CATALOG_KEYS, parseItem } from "./definitions";
import { SEEDS } from "./seed-data";
import {
  countItems,
  createDraft,
  deleteItem,
  discardDraft,
  getActiveItems,
  getActiveVersion,
  getParameter,
  importItems,
  listItems,
  listVersions,
  publishVersion,
  seedCatalogs,
  upsertItem,
} from "./service";

pointToTestDb();

describe("esquemas de catálogos", () => {
  it("todos los datos iniciales cumplen el esquema de su catálogo y no repiten código", () => {
    for (const seed of SEEDS) {
      const codes = seed.items.map((i) => parseItem(seed.catalog, i).code);
      expect(new Set(codes).size, seed.catalog).toBe(codes.length);
    }
  });
  it("todo parámetro sembrado cita su norma y está pendiente de validar (TODO-NORMA)", () => {
    const params = SEEDS.find((s) => s.catalog === "parameters")!.items;
    expect(params.length).toBeGreaterThan(10);
    for (const p of params) {
      expect(p.sourceNorm, String(p.key)).toBeTruthy();
      expect(p.todoNorma).toBe(true);
    }
  });
  it("rechaza datos inválidos con mensajes legibles", () => {
    expect(() =>
      parseItem("parameters", { key: "Mal Nombre", value: 1, description: "x y z" }),
    ).toThrow(/key/);
    expect(() => parseItem("economic_activities", { ciiu: "12", name: "X", riskClass: 3 })).toThrow(
      /CIIU/,
    );
    expect(() =>
      parseItem("economic_activities", { ciiu: "0111", name: "Cultivo de cereales", riskClass: 6 }),
    ).toThrow(/riskClass/);
    expect(
      parseItem("economic_activities", { ciiu: "0111", name: "Cultivo de cereales", riskClass: 2 })
        .code,
    ).toBe("0111");
  });
  it("hay un esquema por cada catálogo declarado", () => {
    expect(CATALOG_KEYS).toHaveLength(15);
  });
});

describe.skipIf(!hasTestDb)("versionado de catálogos", () => {
  afterAll(closeDb);

  const param = (key: string, value: number) => ({
    key,
    value,
    unit: "días",
    description: "Parámetro de prueba",
    sourceNorm: "Norma X",
    todoNorma: false,
  });

  it("flujo completo: borrador → elementos → publicación con vigencia y norma fuente", async () => {
    const d1 = await createDraft("parameters", "admin");
    expect(d1).toMatchObject({ version: 1, status: "draft" });
    await expect(createDraft("parameters", "admin")).rejects.toThrow(/borrador abierto/);
    await upsertItem(d1.id, param("plazo.a", 2));
    await upsertItem(d1.id, param("plazo.b", 15));
    await upsertItem(d1.id, param("plazo.a", 3)); // actualiza por código
    expect(await countItems(d1.id)).toBe(2);
    await expect(
      publishVersion(d1.id, { effectiveFrom: "2026-01-01", sourceNorm: "" }, "admin"),
    ).rejects.toThrow(/norma fuente/);
    const pub = await publishVersion(
      d1.id,
      { effectiveFrom: "2026-01-01", sourceNorm: "Resolución X de 2026" },
      "admin",
    );
    expect(pub).toMatchObject({
      status: "published",
      effectiveFrom: "2026-01-01",
      sourceNorm: "Resolución X de 2026",
      publishedBy: "admin",
    });
    expect(await getParameter("plazo.a", 0, "2026-06-01")).toBe(3);
    expect(await getParameter("no.existe", 99)).toBe(99);
  });

  it("una versión publicada es inmutable (aplicación y base de datos)", async () => {
    const [v] = await listVersions("parameters");
    await expect(upsertItem(v.id, param("plazo.c", 1))).rejects.toThrow(/publicada/);
    await expect(deleteItem(v.id, "plazo.a")).rejects.toThrow(/publicada/);
    await expect(discardDraft(v.id)).rejects.toThrow(/publicada/);
    // Aun saltándose la aplicación, el trigger lo impide:
    const [item] = await listItems(v.id);
    expect(
      await dbErrorMessage(
        systemDb()
          .update(schema.catalogItem)
          .set({ data: { ...item.data, value: 999 } })
          .where(eq(schema.catalogItem.id, item.id)),
      ),
    ).toMatch(/publicada/);
    expect(
      await dbErrorMessage(
        systemDb().delete(schema.catalogItem).where(eq(schema.catalogItem.id, item.id)),
      ),
    ).toMatch(/publicada/);
    expect(
      await dbErrorMessage(
        systemDb().insert(schema.catalogItem).values({ versionId: v.id, code: "x", data: {} }),
      ),
    ).toMatch(/publicada/);
    expect(
      await dbErrorMessage(
        systemDb()
          .update(schema.catalogVersion)
          .set({ sourceNorm: "otra" })
          .where(eq(schema.catalogVersion.id, v.id)),
      ),
    ).toMatch(/publicada/);
    expect(
      await dbErrorMessage(
        systemDb().delete(schema.catalogVersion).where(eq(schema.catalogVersion.id, v.id)),
      ),
    ).toMatch(/publicada/);
    expect(
      await dbErrorMessage(
        systemDb()
          .update(schema.catalogVersion)
          .set({ status: "draft" })
          .where(eq(schema.catalogVersion.id, v.id)),
      ),
    ).toMatch(/borrador/);
  });

  it("nueva versión copia la anterior, retira la vigente y conserva el histórico por fecha", async () => {
    const d2 = await createDraft("parameters", "admin");
    expect(d2.version).toBe(2);
    expect(await countItems(d2.id)).toBe(2); // copiada de la v1
    await upsertItem(d2.id, param("plazo.a", 5));
    await expect(
      publishVersion(d2.id, { effectiveFrom: "2026-01-01", sourceNorm: "Norma Y" }, "admin"),
    ).rejects.toThrow(/posterior/);
    await publishVersion(
      d2.id,
      { effectiveFrom: "2027-03-01", sourceNorm: "Norma Y de 2027" },
      "admin",
    );
    const versions = await listVersions("parameters");
    expect(versions.map((v) => [v.version, v.status, v.effectiveTo])).toEqual([
      [2, "published", null],
      [1, "retired", "2027-02-28"],
    ]);
    // Un cálculo de 2026 sigue reproduciéndose con la v1; uno de 2027 usa la v2
    expect((await getActiveVersion("parameters", "2026-12-31"))?.version).toBe(1);
    expect((await getActiveVersion("parameters", "2027-03-01"))?.version).toBe(2);
    expect(await getParameter("plazo.a", 0, "2026-12-31")).toBe(3);
    expect(await getParameter("plazo.a", 0, "2027-03-01")).toBe(5);
    expect(await getActiveVersion("parameters", "2025-12-31")).toBeNull();
    expect((await getActiveItems("parameters", "2027-06-01"))?.items.map((i) => i.code)).toEqual([
      "plazo.a",
      "plazo.b",
    ]);
  });

  it("descartar un borrador lo elimina con sus elementos; no se publica uno vacío", async () => {
    const d = await createDraft("hazard_catalog", "admin");
    await expect(
      publishVersion(d.id, { effectiveFrom: "2026-01-01", sourceNorm: "GTC 45" }, "admin"),
    ).rejects.toThrow(/sin elementos|no tiene elementos/);
    await upsertItem(d.id, { family: "Físico", hazard: "Ruido", description: "" });
    await discardDraft(d.id);
    expect(await listVersions("hazard_catalog")).toEqual([]);
    expect(
      await systemDb()
        .select()
        .from(schema.catalogItem)
        .where(eq(schema.catalogItem.versionId, d.id)),
    ).toEqual([]);
  });

  it("importación: reporta filas inválidas y duplicados; en modo estricto no importa nada", async () => {
    const d = await createDraft("economic_activities", "admin");
    const rows = [
      {
        ciiu: "0111",
        name: "Cultivo de cereales",
        riskClass: 2,
        sourceNorm: "Decreto 768 de 2022",
      },
      { ciiu: "99", name: "Inválida", riskClass: 2 },
      { ciiu: "0111", name: "Duplicada", riskClass: 2 },
      { ciiu: "0112", name: "Cultivo de arroz", riskClass: 2 },
    ];
    const strict = await importItems(d.id, rows, { strict: true });
    expect(strict.imported).toBe(0);
    expect(strict.errors.map((e) => e.row)).toEqual([2, 3]);
    expect(await countItems(d.id)).toBe(0);
    const lenient = await importItems(d.id, rows);
    expect(lenient).toMatchObject({ imported: 2 });
    expect(lenient.errors).toHaveLength(2);
    expect(await countItems(d.id)).toBe(2);
  });

  it("el seed publica la v1 de los catálogos con datos y es idempotente", async () => {
    await systemDb().execute(sql`TRUNCATE catalog_item, catalog_version CASCADE`); // vaciar no pasa por los triggers de fila
    const first = await seedCatalogs();
    expect(first).toContain("gtc45_scales");
    expect(await seedCatalogs()).toEqual([]);
    const gtc = (await getActiveItems<{
      dimension: string;
      level: string;
      value: number | null;
      min: number | null;
      max: number | null;
    }>("gtc45_scales"))!;
    expect(gtc.version.status).toBe("published");
    const risk = gtc.items.filter((i) => i.dimension === "risk");
    expect(risk.map((r) => [r.level, r.min, r.max])).toEqual([
      ["I", 600, 4000],
      ["II", 150, 500],
      ["III", 40, 120],
      ["IV", 20, 20],
    ]);
    const groups = (await getActiveItems<{
      group: number;
      priority: number;
      riskClasses: number[];
      minWorkers: number | null;
      maxWorkers: number | null;
    }>("size_risk_groups"))!;
    expect(groups.items.map((g) => g.group).sort()).toEqual([21, 60, 60, 7]);
    expect(await getParameter("at.reporte_arl_dias_habiles", 0)).toBe(2);
    expect(await getParameter("conservacion.registros_anios", 0)).toBe(20);
  });
});
