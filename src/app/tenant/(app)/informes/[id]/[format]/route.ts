import { NextResponse } from "next/server";
import { requirePermission } from "@/core/auth/session";
import { buildReport, reportDef } from "@/modules/reports/builders";
import { FORMATS, brandOf, renderReport, type Format } from "@/modules/reports/render";

/** Descarga un informe regulatorio en PDF (con la marca de la empresa), Excel o CSV. */
export async function GET(
  req: Request,
  { params }: RouteContext<"/tenant/informes/[id]/[format]">,
) {
  const { id, format } = await params;
  const def = reportDef(id);
  if (!def || !FORMATS.includes(format as Format))
    return new NextResponse("No encontrado", { status: 404 });
  const ctx = await requirePermission(def.module, "view");
  const y = Number(new URL(req.url).searchParams.get("year"));
  const year = Number.isInteger(y) && y > 2000 && y < 2100 ? y : new Date().getUTCFullYear();
  const report = await buildReport(id, ctx.tenant.tenantId, year, ctx.tenant.tradeName);
  if (!report) return new NextResponse("No encontrado", { status: 404 });
  const out = await renderReport(report, format as Format, brandOf(ctx));
  return new NextResponse(Buffer.from(out.body), {
    headers: {
      "Content-Type": out.mime,
      "Content-Disposition": `attachment; filename="${out.filename.replace(/(\.[a-z]+)$/, `-${year}$1`)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
