"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformStaff } from "@/core/auth/session";
import { withPlatform } from "@/core/db";
import { isCatalogKey } from "@/modules/platform/catalogs/definitions";
import { rowsFromFile } from "@/modules/platform/catalogs/csv";
import {
  createDraft,
  deleteItem,
  discardDraft,
  getVersion,
  importItems,
  publishVersion,
  upsertItem,
  type ImportReport,
} from "@/modules/platform/catalogs/service";

export type CatalogState = { ok: boolean; message: string; report?: ImportReport } | null;

async function guard(action: string, detail: Record<string, unknown>) {
  const staff = await requirePlatformStaff({ allow: ["SUPER_ADMIN"] });
  await withPlatform(
    { actorId: staff.user.id, action, reason: JSON.stringify(detail) },
    async () => undefined,
  );
  return staff.user.id;
}

export async function createDraftAction(catalog: string): Promise<void> {
  if (!isCatalogKey(catalog)) throw new Error("Catálogo inválido");
  const actor = await guard("catalog.create_draft", { catalog });
  const d = await createDraft(catalog, actor);
  revalidatePath("/catalogos");
  redirect(`/catalogos/${catalog}/${d.id}`);
}

export async function saveItemAction(
  versionId: string,
  _prev: CatalogState,
  form: FormData,
): Promise<CatalogState> {
  await guard("catalog.save_item", { versionId });
  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("json") ?? ""));
  } catch {
    return { ok: false, message: "El JSON no es válido" };
  }
  try {
    const { code } = await upsertItem(versionId, raw);
    revalidatePath(`/catalogos`, "layout");
    return { ok: true, message: `Guardado: ${code}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "No se pudo guardar" };
  }
}

export async function deleteItemAction(versionId: string, code: string): Promise<void> {
  await guard("catalog.delete_item", { versionId, code });
  await deleteItem(versionId, code);
  revalidatePath(`/catalogos`, "layout");
}

export async function importAction(
  versionId: string,
  _prev: CatalogState,
  form: FormData,
): Promise<CatalogState> {
  await guard("catalog.import", { versionId });
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { ok: false, message: "Selecciona un archivo CSV o JSON" };
  if (file.size > 5 * 1024 * 1024) return { ok: false, message: "El archivo supera 5 MB" };
  try {
    const rows = rowsFromFile(await file.text(), file.name);
    if (rows.length > 20_000) return { ok: false, message: "Máximo 20.000 filas por archivo" };
    const strict = form.get("strict") === "on";
    const report = await importItems(versionId, rows, { strict });
    revalidatePath(`/catalogos`, "layout");
    const base = report.imported
      ? `Importadas ${report.imported} filas.`
      : "No se importó ninguna fila.";
    return {
      ok: report.imported > 0 || report.errors.length === 0,
      message: report.errors.length ? `${base} ${report.errors.length} con errores.` : base,
      report,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "No se pudo leer el archivo" };
  }
}

export async function publishAction(
  versionId: string,
  _prev: CatalogState,
  form: FormData,
): Promise<CatalogState> {
  const actor = await guard("catalog.publish", { versionId });
  const v = await getVersion(versionId);
  if (!v) return { ok: false, message: "Versión no encontrada" };
  try {
    await publishVersion(
      versionId,
      {
        effectiveFrom: String(form.get("effectiveFrom") ?? ""),
        sourceNorm: String(form.get("sourceNorm") ?? ""),
        notes: String(form.get("notes") ?? ""),
      },
      actor,
    );
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "No se pudo publicar" };
  }
  revalidatePath("/catalogos", "layout");
  redirect(`/catalogos/${v.catalog}`);
}

export async function discardAction(versionId: string): Promise<void> {
  await guard("catalog.discard", { versionId });
  const v = await getVersion(versionId);
  await discardDraft(versionId);
  revalidatePath("/catalogos", "layout");
  redirect(v ? `/catalogos/${v.catalog}` : "/catalogos");
}
