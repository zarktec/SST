import Link from "@/components/ui/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { SEVERITY } from "@/modules/incidents/rules";
import { listIncidents } from "@/modules/incidents/service";
import { listWorkCenters } from "@/modules/company/service";
import { listWorkers } from "@/modules/workers/service";
import { ReportForm } from "./forms";
import { FormModal } from "@/components/ui/modal";

export const metadata = { title: "Accidentes e incidentes" };

export default async function IncidentsPage() {
  const ctx = await requirePermission("incidents", "view");
  const t = ctx.tenant.tenantId;
  const canWorkers = can(ctx.permissions, "workers", "view");
  const [rows, centers, people] = await Promise.all([
    listIncidents(t),
    listWorkCenters(t),
    canWorkers ? listWorkers(t, { status: "active" }) : Promise.resolve([]),
  ]);
  const urgent = rows.filter(
    (r) => r.report && (r.report.state === "vencido" || r.report.state === "vence_hoy"),
  );
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Accidentes e incidentes de trabajo</h1>
      <nav className="flex gap-2">
        <Link
          href="/accidentes/enfermedad-laboral"
          className="min-h-11 rounded-md border px-3 py-2 text-sm"
        >
          Enfermedad laboral
        </Link>
      </nav>
      {urgent.length > 0 && (
        <Card>
          <CardTitle>Reportes a la ARL / EPS pendientes</CardTitle>
          <ul className="mt-2 space-y-1 text-sm">
            {urgent.map((r) => (
              <li key={r.id}>
                <Badge variant="destructive">
                  {r.report!.state === "vencido" ? "Plazo vencido" : "Vence hoy"}
                </Badge>{" "}
                <Link className="text-primary underline" href={`/accidentes/${r.id}`}>
                  {r.person} · {formatDate(r.arlDeadline!)}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {can(ctx.permissions, "incidents", "create") && (
        <Card>
          <CardTitle>Reportar un evento</CardTitle>
          <div className="mt-3">
            <FormModal
              title="Reportar evento"
              trigger="Reportar evento"
              triggerVariant="default"
              size="lg"
            >
              <ReportForm
                people={people.map((p) => ({ id: p.id, name: p.fullName }))}
                centers={centers.map((c) => ({ id: c.id, name: c.name }))}
                defaultName=""
              />
            </FormModal>
          </div>
        </Card>
      )}
      <Card>
        <CardTitle>Eventos</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/accidentes/${r.id}`}
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3"
              >
                <span>
                  <span className="font-semibold">
                    {r.kind === "accident" ? "Accidente" : "Incidente"} · {r.person}
                  </span>
                  <span className="text-muted-foreground block">
                    {formatDate(r.occurredAt.toISOString().slice(0, 10))} · {r.place} ·{" "}
                    {SEVERITY.find((s) => s.value === r.severity)?.label}
                  </span>
                </span>
                <span className="flex gap-2">
                  {r.report?.state === "reportado" ? (
                    <Badge variant="success">Reportado</Badge>
                  ) : (
                    <Badge variant={r.report?.state === "en_plazo" ? "warning" : "destructive"}>
                      ARL pendiente
                    </Badge>
                  )}
                  {r.investigation && (
                    <Badge
                      variant={
                        r.investigation.done
                          ? "success"
                          : r.investigation.overdue
                            ? "destructive"
                            : "warning"
                      }
                    >
                      {r.investigation.done ? "Investigado" : "En investigación"}
                    </Badge>
                  )}
                </span>
              </Link>
            </li>
          ))}
          {rows.length === 0 && <li className="text-muted-foreground py-2">Sin eventos.</li>}
        </ul>
      </Card>
    </div>
  );
}
