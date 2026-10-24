import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { STATUS_LABEL, type Status } from "@/modules/capa/rules";
import { isSevere, SEVERITY } from "@/modules/incidents/rules";
import { getIncident, investigationActions } from "@/modules/incidents/service";
import {
  CompleteButton,
  InvestigationForm,
  LessonsForm,
  PlanActionForm,
  RemitForm,
  ReportedForm,
  StartButton,
} from "../forms";

export const metadata = { title: "Evento de trabajo" };

export default async function IncidentPage({ params }: PageProps<"/tenant/accidentes/[id]">) {
  const ctx = await requirePermission("incidents", "view");
  const { id } = await params;
  const data = await getIncident(ctx.tenant.tenantId, id);
  if (!data) notFound();
  const { incident: i, investigation: inv } = data;
  const edit = can(ctx.permissions, "incidents", "edit");
  const severe = isSevere(i.severity);
  const acts = inv ? await investigationActions(ctx.tenant.tenantId, id) : [];
  const r = i.report;
  return (
    <div className="space-y-4">
      <Link href="/accidentes" className="text-primary text-sm underline">
        ← Accidentes e incidentes
      </Link>
      <h1 className="text-2xl font-bold">
        {i.kind === "accident" ? "Accidente" : "Incidente"} · {i.person}
      </h1>
      <Card>
        <p className="text-sm">
          {formatDate(i.occurredAt.toISOString().slice(0, 10))} · {i.place} ·{" "}
          {SEVERITY.find((s) => s.value === i.severity)?.label}
        </p>
        <p className="mt-2 text-sm whitespace-pre-wrap">{i.description}</p>
        <p className="mt-3">
          <Link className="text-primary text-sm underline" href={`/accidentes/${id}/furat`}>
            Ver datos precargados del FURAT
          </Link>
        </p>
      </Card>
      <Card>
        <CardTitle>Reporte a la ARL y a la EPS</CardTitle>
        <p className="mt-2 text-sm">
          Plazo: {i.arlDeadline ? formatDate(i.arlDeadline) : "—"} (2 días hábiles).{" "}
          {r?.state === "reportado" ? (
            <Badge variant="success">
              Reportado {i.arlReportedAt ? formatDate(i.arlReportedAt) : ""}
              {i.arlReportNumber ? ` · ${i.arlReportNumber}` : ""}
            </Badge>
          ) : r?.state === "vencido" ? (
            <Badge variant="destructive">Plazo vencido</Badge>
          ) : (
            <Badge variant="warning">
              {r?.state === "vence_hoy"
                ? "Vence hoy"
                : `Quedan ${r?.businessDaysLeft ?? 0} días hábiles`}
            </Badge>
          )}
        </p>
        {edit && r?.state !== "reportado" && (
          <div className="mt-3">
            <ReportedForm id={id} />
          </div>
        )}
      </Card>
      <Card>
        <CardTitle>Investigación</CardTitle>
        {!inv ? (
          <div className="mt-2 space-y-2 text-sm">
            <p>La investigación se debe completar dentro de los 15 días siguientes al evento.</p>
            {edit && <StartButton id={id} />}
          </div>
        ) : (
          <div className="mt-2 space-y-4">
            <p className="text-sm">
              Plazo: {formatDate(inv.deadline)} ·{" "}
              {inv.completedAt ? (
                <Badge variant="success">Cerrada</Badge>
              ) : i.investigation?.overdue ? (
                <Badge variant="destructive">Vencida</Badge>
              ) : (
                <Badge variant="warning">En curso</Badge>
              )}
            </p>
            {edit && !inv.completedAt && (
              <InvestigationForm
                id={id}
                severe={severe}
                inv={{
                  team: inv.team,
                  method: inv.method,
                  analysis: inv.analysis,
                  immediateCauses: inv.immediateCauses,
                  basicCauses: inv.basicCauses,
                  conclusions: inv.conclusions,
                }}
              />
            )}
            {inv.completedAt && (
              <div className="space-y-1 text-sm">
                <p>
                  <strong>Causas inmediatas:</strong> {inv.immediateCauses}
                </p>
                <p>
                  <strong>Causas básicas:</strong> {inv.basicCauses}
                </p>
                {inv.conclusions && (
                  <p>
                    <strong>Conclusiones:</strong> {inv.conclusions}
                  </p>
                )}
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold">Plan de acción</h3>
              <ul className="mt-1 text-sm">
                {acts.map((a) => (
                  <li key={a.id}>
                    <Link className="text-primary underline" href={`/acciones/${a.id}`}>
                      {a.title}
                    </Link>{" "}
                    · {formatDate(a.dueDate)} · {STATUS_LABEL[a.status as Status]}
                  </li>
                ))}
                {acts.length === 0 && <li className="text-muted-foreground">Sin acciones aún.</li>}
              </ul>
              {edit && !inv.completedAt && (
                <div className="mt-3">
                  <PlanActionForm id={id} />
                </div>
              )}
            </div>
            {severe && (
              <div className="text-sm">
                <h3 className="font-semibold">Remisión a la ARL (evento grave o mortal)</h3>
                {inv.remittedArlAt ? (
                  <p>Remitida el {formatDate(inv.remittedArlAt)}.</p>
                ) : (
                  edit && <RemitForm id={id} />
                )}
              </div>
            )}
            {edit && !inv.completedAt && <CompleteButton id={id} />}
            {inv.completedAt && edit && (
              <div>
                <h3 className="text-sm font-semibold">Lecciones aprendidas</h3>
                {inv.lessonsDisclosedAt && (
                  <p className="text-muted-foreground text-xs">
                    Divulgadas el {formatDate(inv.lessonsDisclosedAt.toISOString().slice(0, 10))}
                  </p>
                )}
                <LessonsForm id={id} saved={inv.lessonsLearned} />
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
