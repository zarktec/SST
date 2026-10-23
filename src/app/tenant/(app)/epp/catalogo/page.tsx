import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { listItems, ppeMatrix } from "@/modules/ppe/service";
import { AddRequirement, ArchiveButton, ItemForm, RemoveRequirement, StockForm } from "../forms";

export const metadata = { title: "Catálogo de EPP" };

export default async function CatalogPage() {
  const ctx = await requirePermission("ppe", "view");
  const [items, m] = await Promise.all([
    listItems(ctx.tenant.tenantId),
    ppeMatrix(ctx.tenant.tenantId),
  ]);
  const canEdit = can(ctx.permissions, "ppe", "edit");
  const name = new Map(items.map((i) => [i.id, i.name]));
  const positions = [...new Set(m.requirements.map((r) => r.position))].sort();
  return (
    <div className="space-y-4">
      <Link href="/epp" className="text-primary text-sm underline">
        ← EPP
      </Link>
      <h1 className="text-2xl font-bold">Catálogo, inventario y matriz</h1>
      {items.map((i) => (
        <Card key={i.id}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{i.name}</p>
            <Badge variant={i.low ? "destructive" : "default"}>Stock {i.stock}</Badge>
            {i.usefulLifeMonths && <Badge>Vida útil {i.usefulLifeMonths} meses</Badge>}
          </div>
          {canEdit && (
            <details className="mt-2">
              <summary className="text-primary min-h-11 cursor-pointer py-2 text-sm">
                Editar
              </summary>
              <div className="space-y-3">
                <ItemForm item={{ ...i }} />
                {can(ctx.permissions, "ppe", "delete") && <ArchiveButton id={i.id} />}
              </div>
            </details>
          )}
        </Card>
      ))}
      {can(ctx.permissions, "ppe", "create") && (
        <Card>
          <CardTitle>Nuevo EPP</CardTitle>
          <div className="mt-3">
            <ItemForm />
          </div>
        </Card>
      )}
      {canEdit && items.length > 0 && (
        <>
          <Card>
            <CardTitle>Ingreso de inventario</CardTitle>
            <div className="mt-3">
              <StockForm items={items} />
            </div>
          </Card>
          <Card>
            <CardTitle>Matriz por cargo</CardTitle>
            <ul className="mt-2 divide-y text-sm">
              {positions.map((p) => (
                <li key={p} className="py-2">
                  <span className="font-semibold">{p}</span>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {m.requirements
                      .filter((r) => r.position === p)
                      .map((r) => (
                        <RemoveRequirement
                          key={r.id}
                          position={p}
                          itemId={r.itemId}
                          label={`Quitar: ${name.get(r.itemId) ?? "EPP"}`}
                        />
                      ))}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <AddRequirement items={items} />
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
