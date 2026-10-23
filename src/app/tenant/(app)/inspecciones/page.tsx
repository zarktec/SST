import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { itemsToText } from "@/modules/inspections/rules";
import {
  availableCatalogTemplates,
  listInspections,
  listTemplates,
} from "@/modules/inspections/service";
import { ImportTemplate, SyncStatus, TemplateForm, ToggleTemplate } from "./forms";

export const metadata = { title: "Inspecciones" };

export default async function InspectionsPage() {
  const ctx = await requirePermission("inspections", "view");
  const t = ctx.tenant.tenantId;
  const edit = can(ctx.permissions, "inspections", "edit");
  const run = can(ctx.permissions, "inspections", "create");
  const [templates, rows, catalog] = await Promise.all([
    listTemplates(t),
    listInspections(t),
    edit ? availableCatalogTemplates(t) : Promise.resolve([]),
  ]);
  const active = templates.filter((x) => x.active);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Inspecciones</h1>
      <SyncStatus warm={run ? active.map((x) => `/inspecciones/ejecutar/${x.id}`) : []} />
      {run && (
        <Card>
          <CardTitle>Iniciar una inspección</CardTitle>
          <ul className="mt-2 divide-y text-sm">
            {active.map((x) => (
              // Enlace normal (no Link): la navegación completa la atiende el service worker aunque no haya conexión.
              <li key={x.id}>
                <a
                  href={`/inspecciones/ejecutar/${x.id}`}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3"
                >
                  <span className="font-semibold">{x.name}</span>
                  <span className="text-muted-foreground">
                    {x.category} · {x.items.length} ítems
                  </span>
                </a>
              </li>
            ))}
            {active.length === 0 && (
              <li className="text-muted-foreground py-2">
                Aún no hay plantillas activas{edit ? ": crea una abajo." : "."}
              </li>
            )}
          </ul>
        </Card>
      )}
      <Card>
        <CardTitle>Inspecciones realizadas</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/inspecciones/${r.id}`}
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3"
              >
                <span>
                  <span className="font-semibold">{r.templateName}</span>
                  <span className="text-muted-foreground block">
                    {r.place} · {r.inspectorName} ·{" "}
                    {formatDate(r.performedAt.toISOString().slice(0, 10))}
                  </span>
                </span>
                <Badge variant={r.failCount ? "destructive" : "success"}>
                  {r.failCount ? `${r.failCount} hallazgo(s)` : "Sin hallazgos"}
                </Badge>
              </Link>
            </li>
          ))}
          {rows.length === 0 && <li className="text-muted-foreground py-2">Sin inspecciones.</li>}
        </ul>
      </Card>
      {edit && (
        <>
          <Card>
            <CardTitle>Nueva plantilla</CardTitle>
            <div className="mt-3">
              <TemplateForm />
            </div>
          </Card>
          {catalog.length > 0 && (
            <Card>
              <CardTitle>Plantillas de la plataforma</CardTitle>
              <ul className="mt-2 divide-y text-sm">
                {(catalog as unknown as { code: string; name: string; category: string }[]).map(
                  (c) => (
                    <li key={c.code} className="flex items-center justify-between gap-2 py-2">
                      <span>
                        {c.name} · <span className="text-muted-foreground">{c.category}</span>
                      </span>
                      <ImportTemplate code={c.code} />
                    </li>
                  ),
                )}
              </ul>
            </Card>
          )}
          <Card>
            <CardTitle>Plantillas de la empresa</CardTitle>
            <ul className="mt-2 divide-y text-sm">
              {templates.map((x) => (
                <li key={x.id} className="space-y-2 py-3">
                  <p className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {x.name} {!x.active && <Badge>Inactiva</Badge>}
                    </span>
                    <ToggleTemplate id={x.id} active={x.active} />
                  </p>
                  <details>
                    <summary className="text-primary min-h-11 cursor-pointer py-2">Editar</summary>
                    <TemplateForm
                      id={x.id}
                      initial={{
                        name: x.name,
                        category: x.category,
                        itemsText: itemsToText(x.items),
                      }}
                    />
                  </details>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
