import { NextResponse } from "next/server";
import { requireTenantMember } from "@/core/auth/session";
import { withTenant } from "@/core/db";
import { loadPermissions, permissionList } from "@/core/rbac/can";
import { icsFor } from "@/modules/notifications/service";

export async function GET() {
  const ctx = await requireTenantMember();
  const perms = permissionList(
    await withTenant({ tenantId: ctx.tenant.tenantId }, (tx) => loadPermissions(tx, ctx.roleId)),
  );
  const body = await icsFor(ctx.tenant.tenantId, ctx.tenant.tradeName, ctx.tenant.slug, perms);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="obligaciones-sgsst.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
