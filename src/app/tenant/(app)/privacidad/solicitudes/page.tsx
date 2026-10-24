import Link from "next/link";
import { ActionForm } from "@/components/forms/action-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { formatDate } from "@/lib/format";
import { REQUEST_TYPES } from "@/modules/privacy/rules";
import { listRequests } from "@/modules/privacy/service";
import { resolveAction } from "../actions";

export const metadata = { title: "Solicitudes de titulares" };

export default async function RequestsPage() {
  const ctx = await requirePermission("company", "edit");
  const rows = await listRequests(ctx.tenant.tenantId);
  return (
    <div className="space-y-4">
      <Link href="/privacidad" className="text-primary text-sm underline">
        ← Privacidad
      </Link>
      <h1 className="text-2xl font-bold">Solicitudes de los titulares de datos</h1>
      <Card>
        <ul className="divide-y text-sm">
          {rows.map((r) => (
            <li key={r.id} className="space-y-2 py-3">
              <p className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    r.status === "open" ? (r.overdue ? "destructive" : "warning") : "success"
                  }
                >
                  {r.status === "open"
                    ? r.overdue
                      ? "Vencida"
                      : "Abierta"
                    : r.status === "resolved"
                      ? "Respondida"
                      : "Rechazada"}
                </Badge>
                <span className="font-semibold">{r.userName}</span>
                <span className="text-muted-foreground">
                  {r.userEmail} · {REQUEST_TYPES.find((x) => x.value === r.type)?.label} · responder
                  antes del {formatDate(r.dueOn)}
                </span>
              </p>
              <p>{r.detail}</p>
              {r.resolution && <p className="text-muted-foreground">Respuesta: {r.resolution}</p>}
              {r.status === "open" && (
                <details>
                  <summary className="text-primary min-h-11 cursor-pointer py-2">Responder</summary>
                  <ActionForm
                    action={resolveAction}
                    idPrefix={`rs-${r.id}-`}
                    hidden={{ id: r.id }}
                    submit="Registrar respuesta"
                    fields={[
                      {
                        name: "decision",
                        label: "Decisión",
                        type: "select",
                        options: [
                          { value: "resolved", label: "Atendida" },
                          { value: "rejected", label: "Rechazada (con motivo)" },
                        ],
                      },
                      { name: "resolution", label: "Respuesta al titular", type: "textarea" },
                    ]}
                  />
                </details>
              )}
            </li>
          ))}
          {rows.length === 0 && <li className="text-muted-foreground py-2">No hay solicitudes.</li>}
        </ul>
      </Card>
    </div>
  );
}
