import { NextResponse } from "next/server";
import { requirePermission } from "@/core/auth/session";
import { renderPdf } from "@/core/reports/pdf";
import { buildInvestigationReport } from "@/modules/reports/builders";
import { brandOf } from "@/modules/reports/render";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Informe de investigación de un accidente o incidente (Resolución 1401 de 2007) en PDF. */
export async function GET(
  _req: Request,
  { params }: RouteContext<"/tenant/informes/investigacion/[id]">,
) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse("No encontrado", { status: 404 });
  const ctx = await requirePermission("incidents", "view");
  const report = await buildInvestigationReport(ctx.tenant.tenantId, id, ctx.tenant.tradeName);
  if (!report) return new NextResponse("No encontrado", { status: 404 });
  return new NextResponse(Buffer.from(await renderPdf(report, brandOf(ctx))), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="investigacion-${id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
