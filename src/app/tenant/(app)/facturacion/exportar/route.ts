import { NextResponse } from "next/server";
import { paymentsCsv } from "@/modules/billing/portal";
import { requireBillingAdmin } from "../guard";

export async function GET() {
  const ctx = await requireBillingAdmin();
  return new NextResponse(await paymentsCsv(ctx.tenant.tenantId), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pagos.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
