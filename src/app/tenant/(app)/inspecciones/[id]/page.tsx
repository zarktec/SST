import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { formatDate } from "@/lib/format";
import { STATUS_LABEL, type Status } from "@/modules/capa/rules";
import { getInspection } from "@/modules/inspections/service";

export const metadata = { title: "Inspección" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LABEL = { ok: "Cumple", fail: "No cumple", na: "No aplica" } as const;

export default async function InspectionPage({ params }: PageProps<"/tenant/inspecciones/[id]">) {
  const ctx = await requirePermission("inspections", "view");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const d = await getInspection(ctx.tenant.tenantId, id);
  if (!d) notFound();
  const { inspection: i, actions } = d;
  return (
    <div className="space-y-4">
      <Link href="/inspecciones" className="text-primary text-sm underline">
        ← Inspecciones
      </Link>
      <h1 className="text-2xl font-bold">{i.templateName}</h1>
      <p className="text-muted-foreground text-sm">
        {i.place} · {i.inspectorName} · {formatDate(i.performedAt.toISOString().slice(0, 10))}
      </p>
      <Card>
        <CardTitle>Resultados</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {i.results.map((r) => (
            <li key={r.itemId} className="py-2">
              <p className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    r.result === "ok" ? "success" : r.result === "fail" ? "destructive" : "default"
                  }
                >
                  {LABEL[r.result]}
                </Badge>
                {r.text}
              </p>
              {r.note && <p className="text-muted-foreground mt-1">{r.note}</p>}
            </li>
          ))}
        </ul>
        {i.notes && <p className="mt-3 text-sm">{i.notes}</p>}
      </Card>
      {actions.length > 0 && (
        <Card>
          <CardTitle>Acciones generadas</CardTitle>
          <ul className="mt-2 text-sm">
            {actions.map((a) => (
              <li key={a.id}>
                <Link className="text-primary underline" href={`/acciones/${a.id}`}>
                  {a.title}
                </Link>{" "}
                · {formatDate(a.dueDate)} · {STATUS_LABEL[a.status as Status]}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
