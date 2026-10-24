import Link from "@/components/ui/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { formatDate } from "@/lib/format";
import { listHarassmentReports } from "@/modules/convivencia/service";

export const metadata = { title: "Acoso sexual y violencia de género" };
const ST: Record<string, string> = {
  received: "Recibido",
  in_review: "En revisión",
  referred: "Remitido",
  closed: "Cerrado",
};

export default async function HarassmentPage() {
  const ctx = await requirePermission("harassment", "view");
  const rows = await listHarassmentReports(ctx.tenant.tenantId, {
    userId: ctx.user.id,
    email: ctx.user.email,
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reportes de acoso sexual y violencia de género</h1>
      <Card>
        <CardTitle>Reportes ({rows.length})</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/acoso-sexual/${r.id}`}
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3"
              >
                <span>Recibido {formatDate(r.receivedAt)}</span>
                <Badge>{ST[r.status]}</Badge>
              </Link>
            </li>
          ))}
          {rows.length === 0 && <li className="text-muted-foreground py-2">No hay reportes.</li>}
        </ul>
        <p className="text-muted-foreground mt-2 text-xs">Cada consulta queda registrada.</p>
      </Card>
    </div>
  );
}
