import Link from "@/components/ui/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { listDeliveries, listItems, ppeMatrix } from "@/modules/ppe/service";
import { listWorkers } from "@/modules/workers/service";
import { REASONS } from "@/modules/ppe/rules";
import { DeliveryForm } from "./forms";

export const metadata = { title: "EPP" };
const ST: Record<string, ["success" | "destructive" | "warning" | "default", string]> = {
  vigente: ["success", "Vigente"],
  por_vencer: ["warning", "Por vencer"],
  vencido: ["destructive", "Vencido"],
  pendiente: ["default", "Pendiente"],
};

export default async function PpePage() {
  const ctx = await requirePermission("ppe", "view");
  const t = ctx.tenant.tenantId;
  const [matrix, items, deliveries, people] = await Promise.all([
    ppeMatrix(t),
    listItems(t),
    listDeliveries(t, 30),
    listWorkers(t, { status: "active" }),
  ]);
  const low = items.filter((i) => i.low);
  const issues = matrix.rows.flatMap((r) => r.items).filter((i) => i.state !== "vigente").length;
  const canCreate = can(ctx.permissions, "ppe", "create");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Elementos de protección personal</h1>
      <nav className="flex gap-2">
        <Link href="/epp/catalogo" className="min-h-11 rounded-md border px-3 py-2 text-sm">
          Catálogo, inventario y matriz por cargo
        </Link>
      </nav>
      {low.length > 0 && (
        <Alert variant="warning">
          Inventario bajo: {low.map((i) => `${i.name} (${i.stock})`).join(", ")}.
        </Alert>
      )}
      <p className="text-muted-foreground text-sm">
        {issues} EPP pendientes, por vencer o vencidos entre {matrix.rows.length} personas con
        matriz.
      </p>
      {canCreate && (
        <Card>
          <CardTitle>Registrar entrega</CardTitle>
          <div className="mt-3">
            {items.length === 0 ? (
              <p className="text-muted-foreground text-sm">Primero crea los EPP en el catálogo.</p>
            ) : (
              <DeliveryForm
                people={people.map((p) => ({ id: p.id, name: p.fullName }))}
                items={items.map((i) => ({ id: i.id, name: i.name, requiresSize: i.requiresSize }))}
              />
            )}
          </div>
        </Card>
      )}
      {matrix.rows.map((r) => (
        <Card key={r.workerId}>
          <p className="font-semibold">
            {r.name} <span className="text-muted-foreground font-normal">· {r.position}</span>
          </p>
          <ul className="mt-1 text-sm">
            {r.items.map((i) => (
              <li key={i.itemId} className="flex flex-wrap items-center justify-between gap-2 py-1">
                <span>
                  {i.itemName}
                  {i.dueDate ? ` · reposición ${formatDate(i.dueDate)}` : ""}
                </span>
                <Badge variant={ST[i.state][0]}>{ST[i.state][1]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      <Card>
        <CardTitle>Últimas entregas</CardTitle>
        {deliveries.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">Aún no hay entregas.</p>
        ) : (
          <ul className="mt-2 divide-y text-sm">
            {deliveries.map((d) => (
              <li key={d.id} className="py-2">
                <span className="font-semibold">{d.workerName}</span> · {d.quantity} × {d.itemName}
                {d.size ? ` (${d.size})` : ""} · {formatDate(d.deliveredAt)} ·{" "}
                {REASONS.find((r) => r.value === d.reason)?.label}
                {d.hasSignature ? " · firmada" : ""}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
