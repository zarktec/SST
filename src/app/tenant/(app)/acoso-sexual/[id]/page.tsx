import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { getHarassmentReport } from "@/modules/convivencia/service";
import { UpdateForm } from "../forms";

export const metadata = { title: "Reporte de acoso sexual" };

export default async function ReportDetail({ params }: PageProps<"/tenant/acoso-sexual/[id]">) {
  const ctx = await requirePermission("harassment", "view");
  const r = await getHarassmentReport(
    ctx.tenant.tenantId,
    { userId: ctx.user.id, email: ctx.user.email },
    (await params).id,
  );
  if (!r) notFound();
  return (
    <div className="space-y-4">
      <Link href="/acoso-sexual" className="text-primary text-sm underline">
        ← Reportes
      </Link>
      <h1 className="text-2xl font-bold">Reporte recibido el {formatDate(r.receivedAt)}</h1>
      <Badge>{r.status}</Badge>
      <Card>
        <CardTitle>Relato</CardTitle>
        <p className="mt-2 text-sm whitespace-pre-wrap">{r.narrative}</p>
        {r.note && (
          <p className="text-muted-foreground mt-3 text-sm whitespace-pre-wrap">
            Última nota: {r.note}
          </p>
        )}
      </Card>
      {can(ctx.permissions, "harassment", "edit") && r.status !== "closed" && (
        <Card>
          <CardTitle>Registrar avance</CardTitle>
          <div className="mt-3">
            <UpdateForm id={r.id} />
          </div>
        </Card>
      )}
    </div>
  );
}
