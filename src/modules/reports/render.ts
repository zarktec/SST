import "server-only";
import { toCsv } from "@/core/reports/csv";
import { renderPdf } from "@/core/reports/pdf";
import { exportTables, type Brand, type Report } from "@/core/reports/types";
import { toXlsx } from "@/core/reports/xlsx";
import { buildZip } from "@/core/reports/zip";

export type Format = "pdf" | "xlsx" | "csv";
export const FORMATS: Format[] = ["pdf", "xlsx", "csv"];
export const MIME: Record<string, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv; charset=utf-8",
  zip: "application/zip",
};

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60) || "informe";

/** Genera el informe en el formato pedido. CSV con varias tablas se entrega como ZIP de CSV. */
export async function renderReport(report: Report, format: Format, brand: Brand) {
  const base = slug(report.id);
  if (format === "pdf")
    return { body: await renderPdf(report, brand), mime: MIME.pdf, filename: `${base}.pdf` };
  const tables = exportTables(report);
  if (format === "xlsx") return { body: toXlsx(tables), mime: MIME.xlsx, filename: `${base}.xlsx` };
  if (tables.length === 1)
    return { body: toCsv(tables[0]), mime: MIME.csv, filename: `${base}.csv` };
  const { zip } = buildZip(tables.map((t) => ({ path: `${slug(t.name)}.csv`, data: toCsv(t) })));
  return { body: zip, mime: MIME.zip, filename: `${base}-csv.zip` };
}
export const brandOf = (ctx: {
  tenant: { tradeName: string; brand: { primary: string } };
}): Brand => ({
  name: ctx.tenant.tradeName,
  color: ctx.tenant.brand.primary,
});
