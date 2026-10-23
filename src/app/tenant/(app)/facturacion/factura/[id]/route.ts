import { NextResponse } from "next/server";
import { getInvoicePdf } from "@/modules/billing/invoicing";
import { requireBillingAdmin } from "../../guard";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireBillingAdmin();
  const r = await getInvoicePdf(ctx.tenant.tenantId, (await params).id);
  if (!r) return new NextResponse("No encontrado", { status: 404 });
  return new NextResponse(new Uint8Array(r.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${r.number ?? "factura"}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
