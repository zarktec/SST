import { NextResponse } from "next/server";
import { requirePlatformStaff } from "@/core/auth/session";
import { getInvoicePdfForPlatform } from "@/modules/billing/invoicing";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePlatformStaff();
  const r = await getInvoicePdfForPlatform((await params).id, staff.user.id);
  if (!r) return new NextResponse("No encontrado", { status: 404 });
  return new NextResponse(new Uint8Array(r.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${r.number ?? "factura"}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
