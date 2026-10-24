import { NextResponse } from "next/server";
import { requireTenantMember } from "@/core/auth/session";
import { exportAllData } from "@/modules/reports/export-all";

export const maxDuration = 120;

/** Exportación total de los datos de la empresa (portabilidad y cierre de cuenta). Solo el administrador de la empresa. */
export async function GET() {
  const ctx = await requireTenantMember();
  if (ctx.roleKey !== "ADMIN_EMPRESA")
    return new NextResponse("Solo el administrador de la empresa puede exportar todos los datos.", {
      status: 403,
    });
  const zip = await exportAllData(ctx.tenant.tenantId, ctx.tenant.tradeName);
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="exportacion-${ctx.tenant.slug}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
