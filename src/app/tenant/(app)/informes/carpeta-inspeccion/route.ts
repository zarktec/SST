import { NextResponse } from "next/server";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { buildInspectionFolder } from "@/modules/reports/inspection-folder";
import { brandOf } from "@/modules/reports/render";

export const maxDuration = 120;

/** "Carpeta de inspección" con un clic: ZIP con índice en PDF y las evidencias organizadas (ver `inspection-folder.ts`). */
export async function GET(req: Request) {
  const ctx = await requirePermission("reports", "view");
  const y = Number(new URL(req.url).searchParams.get("year"));
  const year = Number.isInteger(y) && y > 2000 && y < 2100 ? y : new Date().getUTCFullYear();
  const { zip } = await buildInspectionFolder({
    tenantId: ctx.tenant.tenantId,
    tenantName: ctx.tenant.tradeName,
    brand: brandOf(ctx),
    year,
    allow: (m) => can(ctx.permissions, m, "view"),
  });
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="carpeta-inspeccion-${year}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
