import { NextResponse } from "next/server";
import { requirePermission } from "@/core/auth/session";
import { resolveTenantByHost } from "@/core/tenancy/resolve";
import { currentHost } from "@/core/auth/session";
import { buildCertificate } from "@/modules/training/certificate";
import { certificateData } from "@/modules/training/service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission("training", "view");
  const r = await certificateData(ctx.tenant.tenantId, (await params).id);
  if (!r) return new NextResponse("No encontrado", { status: 404 });
  const tenant = await resolveTenantByHost(await currentHost());
  const pdf = await buildCertificate({
    companyName: ctx.tenant.tradeName,
    brandHex: tenant?.brand.primary ?? "#0f766e",
    workerName: r.name,
    documentLast4: r.last4,
    courseName: r.course.name,
    date: r.session.date,
    hours: r.course.durationHours,
    score: r.a.score,
    trainer: r.session.trainer,
    evidenceHash: r.a.evidenceHash,
  });
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="certificado-${r.a.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
