import "server-only";
import { bogotaDate } from "@/core/calendar/business-days";
import type { PermissionModule } from "@/core/rbac/roles";
import { renderPdf } from "@/core/reports/pdf";
import type { Brand, Report } from "@/core/reports/types";
import { toXlsx } from "@/core/reports/xlsx";
import { buildZip, type ZipEntry } from "@/core/reports/zip";
import { exportTables } from "@/core/reports/types";
import { masterList } from "@/modules/documents/service";
import { listIncidents } from "@/modules/incidents/service";
import { REPORTS, buildInvestigationReport, buildReport } from "./builders";
import { todayYmd } from "@/lib/dates";

/**
 * "Carpeta de inspección" con un clic: ZIP con los informes de la empresa organizados por ciclo PHVA, los documentos vigentes, las
 * investigaciones de accidentes cerradas y un índice en PDF con la huella SHA-256 de cada archivo.
 * TODO-NORMA: la organización por estándar de la Resolución 0312 requiere el catálogo oficial de estándares (hoy vacío).
 */
export async function buildInspectionFolder(opts: {
  tenantId: string;
  tenantName: string;
  brand: Brand;
  year: number;
  allow: (m: PermissionModule) => boolean;
}) {
  const { tenantId, tenantName, brand, year, allow } = opts;
  const entries: ZipEntry[] = [];
  const descriptions = new Map<string, string>();
  const add = (path: string, data: Uint8Array | string, description: string) => {
    entries.push({ path, data });
    descriptions.set(path, description);
  };

  for (const def of REPORTS.filter((r) => allow(r.module))) {
    const report = await buildReport(def.id, tenantId, year, tenantName).catch(() => null);
    if (!report) continue;
    add(`${def.phva}/${def.id}.pdf`, await renderPdf(report, brand), def.title);
    add(`${def.phva}/${def.id}.xlsx`, toXlsx(exportTables(report)), `${def.title} (Excel)`);
  }
  if (allow("documents")) {
    for (const d of (await masterList(tenantId).catch(() => [])).filter((x) => x.current)) {
      const doc: Report = {
        id: d.code,
        title: `${d.code} · ${d.title}`,
        subtitle: `Versión ${d.current!.version} · vigente desde ${d.current!.effectiveFrom ?? "—"} · aprobó ${d.current!.approvedName ?? "—"}`,
        sections: [
          { heading: "Contenido", text: d.current!.body.split(/\r?\n/) },
          { heading: "Control", text: [`Huella de evidencia: ${d.current!.evidenceHash ?? "—"}`] },
        ],
      };
      add(
        `0-Documentos/${d.code}-v${d.current!.version}.pdf`,
        await renderPdf(doc, brand),
        `Documento vigente: ${d.title}`,
      );
    }
  }
  if (allow("incidents")) {
    const events = (await listIncidents(tenantId).catch(() => [])).filter(
      (e) => e.investigation?.done && bogotaDate(e.occurredAt).startsWith(String(year)),
    );
    for (const e of events) {
      const r = await buildInvestigationReport(tenantId, e.id, tenantName);
      if (r)
        add(
          `3-Verificar/investigaciones/${bogotaDate(e.occurredAt)}-${e.id.slice(0, 8)}.pdf`,
          await renderPdf(r, brand),
          `Investigación de ${e.kind === "accident" ? "accidente" : "incidente"} del ${bogotaDate(e.occurredAt)}`,
        );
    }
  }

  const { manifest } = buildZip(entries);
  const index: Report = {
    id: "indice",
    title: "Carpeta de inspección del SG-SST",
    subtitle: `${tenantName} · año ${year} · generada el ${todayYmd()}`,
    sections: [
      {
        heading: "Cómo está organizada",
        text: [
          "Los archivos están agrupados por ciclo PHVA (1-Planear, 2-Hacer, 3-Verificar, 4-Actuar) y los documentos vigentes en 0-Documentos.",
          "La columna SHA-256 permite comprobar que ningún archivo se alteró después de generar la carpeta.",
          "Pendiente (TODO-NORMA): organización por estándar de la Resolución 0312, cuando se cargue el catálogo oficial de estándares.",
        ],
      },
      {
        heading: "Contenido",
        table: {
          name: "Contenido",
          head: ["Archivo", "Descripción", "SHA-256 (16 primeros)"],
          rows: manifest.map((m) => [
            m.path,
            descriptions.get(m.path) ?? "",
            m.sha256.slice(0, 16),
          ]),
        },
      },
    ],
  };
  const indexPdf = await renderPdf(index, brand);
  const final = buildZip([
    { path: "00-INDICE.pdf", data: indexPdf },
    ...entries,
    { path: "manifest.json", data: JSON.stringify(manifest, null, 2) },
  ]);
  return { zip: final.zip, files: entries.length + 2 };
}
