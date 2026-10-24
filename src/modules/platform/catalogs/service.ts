import "server-only";
import { and, asc, desc, eq, lte, max, or, isNull, gte, sql } from "drizzle-orm";
import { schema, systemDb } from "@/core/db";
import { CATALOG_KEYS, CATALOGS, parseItem, type CatalogKey } from "./definitions";
import { todayYmd } from "@/lib/dates";

const { catalogVersion, catalogItem } = schema;
export type CatalogVersion = typeof catalogVersion.$inferSelect;
export type CatalogItem = typeof catalogItem.$inferSelect;

export async function listVersions(catalog: CatalogKey): Promise<CatalogVersion[]> {
  return systemDb()
    .select()
    .from(catalogVersion)
    .where(eq(catalogVersion.catalog, catalog))
    .orderBy(desc(catalogVersion.version));
}

export async function getVersion(id: string): Promise<CatalogVersion | null> {
  const [v] = await systemDb().select().from(catalogVersion).where(eq(catalogVersion.id, id));
  return v ?? null;
}

export async function listItems(
  versionId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<CatalogItem[]> {
  return systemDb()
    .select()
    .from(catalogItem)
    .where(eq(catalogItem.versionId, versionId))
    .orderBy(asc(catalogItem.sortOrder), asc(catalogItem.code))
    .limit(opts.limit ?? 1000)
    .offset(opts.offset ?? 0);
}

export async function countItems(versionId: string): Promise<number> {
  const [r] = await systemDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(catalogItem)
    .where(eq(catalogItem.versionId, versionId));
  return r.n;
}

/** Resumen por catálogo para el panel: última publicada, borrador abierto y n.º de elementos. */
export async function catalogOverview() {
  const rows = await systemDb().select().from(catalogVersion).orderBy(desc(catalogVersion.version));
  return CATALOG_KEYS.map((key) => {
    const versions = rows.filter((r) => r.catalog === key);
    return {
      key,
      label: CATALOGS[key].label,
      description: CATALOGS[key].description,
      published: versions.find((v) => v.status === "published") ?? null,
      draft: versions.find((v) => v.status === "draft") ?? null,
    };
  });
}

/**
 * Versión vigente de un catálogo en una fecha (la publicada cuya vigencia cubre la fecha).
 * Las empresas guardan este id junto a lo que calculan para que el resultado sea reproducible.
 */
export async function getActiveVersion(
  catalog: CatalogKey,
  at: string = todayYmd(),
): Promise<CatalogVersion | null> {
  const [v] = await systemDb()
    .select()
    .from(catalogVersion)
    .where(
      and(
        eq(catalogVersion.catalog, catalog),
        or(eq(catalogVersion.status, "published"), eq(catalogVersion.status, "retired")),
        lte(catalogVersion.effectiveFrom, at),
        or(isNull(catalogVersion.effectiveTo), gte(catalogVersion.effectiveTo, at)),
      ),
    )
    .orderBy(desc(catalogVersion.version))
    .limit(1);
  return v ?? null;
}

/** Elementos tipados de la versión vigente. */
export async function getActiveItems<T = Record<string, unknown>>(
  catalog: CatalogKey,
  at?: string,
): Promise<{ version: CatalogVersion; items: ({ code: string } & T)[] } | null> {
  const version = await getActiveVersion(catalog, at);
  if (!version) return null;
  const items = await listItems(version.id);
  return { version, items: items.map((i) => ({ code: i.code, ...(i.data as T) })) };
}

/** Valor de un parámetro normativo de la versión vigente (o `fallback` si no existe). */
export async function getParameter<T extends number | string | boolean>(
  key: string,
  fallback: T,
  at?: string,
): Promise<T> {
  const active = await getActiveItems<{ value: T }>("parameters", at);
  return active?.items.find((i) => i.code === key)?.value ?? fallback;
}

/** Crea un borrador, copiando los elementos de la versión indicada (o de la última publicada). Solo un borrador abierto por catálogo. */
export async function createDraft(
  catalog: CatalogKey,
  actorId: string,
  copyFromId?: string,
): Promise<CatalogVersion> {
  return systemDb().transaction(async (tx) => {
    const open = await tx
      .select()
      .from(catalogVersion)
      .where(and(eq(catalogVersion.catalog, catalog), eq(catalogVersion.status, "draft")));
    if (open.length)
      throw new Error("Ya hay un borrador abierto para este catálogo; publícalo o descártalo");
    const [last] = await tx
      .select({ v: max(catalogVersion.version) })
      .from(catalogVersion)
      .where(eq(catalogVersion.catalog, catalog));
    const [draft] = await tx
      .insert(catalogVersion)
      .values({ catalog, version: (last?.v ?? 0) + 1, status: "draft", createdBy: actorId })
      .returning();
    const sourceId =
      copyFromId ??
      (
        await tx
          .select()
          .from(catalogVersion)
          .where(and(eq(catalogVersion.catalog, catalog), eq(catalogVersion.status, "published")))
          .orderBy(desc(catalogVersion.version))
          .limit(1)
      )[0]?.id;
    if (sourceId) {
      await tx.execute(
        sql`INSERT INTO catalog_item (version_id, code, data, sort_order) SELECT ${draft.id}, code, data, sort_order FROM catalog_item WHERE version_id = ${sourceId}`,
      );
    }
    return draft;
  });
}

async function assertDraft(versionId: string): Promise<CatalogVersion> {
  const v = await getVersion(versionId);
  if (!v) throw new Error("Versión no encontrada");
  if (v.status !== "draft")
    throw new Error("La versión está publicada y no se puede modificar; crea un borrador nuevo");
  return v;
}

export async function upsertItem(
  versionId: string,
  raw: unknown,
  sortOrder?: number,
): Promise<{ code: string }> {
  const v = await assertDraft(versionId);
  const { code, data } = parseItem(v.catalog as CatalogKey, raw);
  await systemDb()
    .insert(catalogItem)
    .values({ versionId, code, data, sortOrder: sortOrder ?? 0 })
    .onConflictDoUpdate({
      target: [catalogItem.versionId, catalogItem.code],
      set: { data, ...(sortOrder !== undefined ? { sortOrder } : {}), updatedAt: new Date() },
    });
  return { code };
}

export async function deleteItem(versionId: string, code: string): Promise<void> {
  await assertDraft(versionId);
  await systemDb()
    .delete(catalogItem)
    .where(and(eq(catalogItem.versionId, versionId), eq(catalogItem.code, code)));
}

export type ImportReport = { imported: number; errors: { row: number; message: string }[] };

/** Importa filas (de CSV/JSON) a un borrador. Todo o nada si `strict`; si no, importa las válidas y reporta las demás. */
export async function importItems(
  versionId: string,
  rows: unknown[],
  opts: { strict?: boolean } = {},
): Promise<ImportReport> {
  const v = await assertDraft(versionId);
  const parsed: { code: string; data: Record<string, unknown>; sort: number }[] = [];
  const errors: ImportReport["errors"] = [];
  const seen = new Set<string>();
  rows.forEach((raw, i) => {
    try {
      const { code, data } = parseItem(v.catalog as CatalogKey, raw);
      if (seen.has(code)) throw new Error(`código duplicado en el archivo: ${code}`);
      seen.add(code);
      parsed.push({ code, data, sort: i });
    } catch (e) {
      errors.push({ row: i + 1, message: e instanceof Error ? e.message : "fila inválida" });
    }
  });
  if (opts.strict && errors.length) return { imported: 0, errors };
  await systemDb().transaction(async (tx) => {
    for (const p of parsed) {
      await tx
        .insert(catalogItem)
        .values({ versionId, code: p.code, data: p.data, sortOrder: p.sort })
        .onConflictDoUpdate({
          target: [catalogItem.versionId, catalogItem.code],
          set: { data: p.data, sortOrder: p.sort, updatedAt: new Date() },
        });
    }
  });
  return { imported: parsed.length, errors };
}

export async function discardDraft(versionId: string): Promise<void> {
  await assertDraft(versionId);
  await systemDb().delete(catalogVersion).where(eq(catalogVersion.id, versionId));
}

/** Publica el borrador: fija vigencia y norma fuente y retira la versión publicada anterior (effective_to = día anterior). */
export async function publishVersion(
  versionId: string,
  input: { effectiveFrom: string; sourceNorm: string; notes?: string },
  actorId: string,
): Promise<CatalogVersion> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom))
    throw new Error("Fecha de vigencia inválida");
  if (input.sourceNorm.trim().length < 3) throw new Error("Indica la norma fuente de esta versión");
  return systemDb().transaction(async (tx) => {
    const [v] = await tx.select().from(catalogVersion).where(eq(catalogVersion.id, versionId));
    if (!v || v.status !== "draft") throw new Error("Solo se puede publicar un borrador");
    const [n] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(catalogItem)
      .where(eq(catalogItem.versionId, versionId));
    if (n.n === 0) throw new Error("El borrador no tiene elementos");
    const [prev] = await tx
      .select()
      .from(catalogVersion)
      .where(and(eq(catalogVersion.catalog, v.catalog), eq(catalogVersion.status, "published")))
      .orderBy(desc(catalogVersion.version))
      .limit(1);
    if (prev) {
      if (prev.effectiveFrom && input.effectiveFrom <= prev.effectiveFrom)
        throw new Error(
          `La vigencia debe ser posterior a la de la versión ${prev.version} (${prev.effectiveFrom})`,
        );
      const dayBefore = new Date(
        new Date(`${input.effectiveFrom}T00:00:00Z`).getTime() - 86_400_000,
      )
        .toISOString()
        .slice(0, 10);
      await tx
        .update(catalogVersion)
        .set({ status: "retired", effectiveTo: dayBefore, updatedAt: new Date() })
        .where(eq(catalogVersion.id, prev.id));
    }
    const [pub] = await tx
      .update(catalogVersion)
      .set({
        status: "published",
        effectiveFrom: input.effectiveFrom,
        sourceNorm: input.sourceNorm.trim(),
        notes: input.notes ?? "",
        publishedBy: actorId,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(catalogVersion.id, versionId))
      .returning();
    return pub;
  });
}

/** Siembra la versión 1 de cada catálogo con datos iniciales (idempotente: no toca catálogos que ya tengan versiones). */
export async function seedCatalogs(actorId = "system"): Promise<string[]> {
  const { SEEDS } = await import("./seed-data");
  const seeded: string[] = [];
  for (const seed of SEEDS) {
    if ((await listVersions(seed.catalog)).length) continue;
    const draft = await createDraft(seed.catalog, actorId);
    const report = await importItems(draft.id, seed.items, { strict: true });
    if (report.errors.length)
      throw new Error(
        `Seed inválido (${seed.catalog}): fila ${report.errors[0].row}: ${report.errors[0].message}`,
      );
    await publishVersion(
      draft.id,
      {
        effectiveFrom: "2019-01-01",
        sourceNorm: seed.sourceNorm,
        notes: "Carga inicial; pendiente de validación por experto SST",
      },
      actorId,
    );
    seeded.push(seed.catalog);
  }
  return seeded;
}
