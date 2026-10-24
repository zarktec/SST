import Link from "next/link";
import { ActionForm, RunButton } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { todayYmd } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { PVE_TYPES, RISK_LEVELS } from "@/modules/pve/rules";
import { listCases, listPrograms, pveSummary } from "@/modules/pve/service";
import { listWorkers } from "@/modules/workers/service";
import {
  activityAction,
  activityDoneAction,
  caseAction,
  closeProgramAction,
  programAction,
} from "./actions";

export const metadata = { title: "Vigilancia epidemiológica" };
const label = (l: readonly { value: string; label: string }[], v: string) =>
  l.find((x) => x.value === v)?.label ?? v;

export default async function PvePage() {
  const ctx = await requirePermission("medical", "view");
  const t = ctx.tenant.tenantId;
  const create = can(ctx.permissions, "medical", "create");
  const edit = can(ctx.permissions, "medical", "edit");
  const today = todayYmd();
  const [sum, programs, cases, people] = await Promise.all([
    pveSummary(t),
    listPrograms(t),
    listCases(t),
    create && can(ctx.permissions, "workers", "view")
      ? listWorkers(t, { status: "active" })
      : Promise.resolve([]),
  ]);
  const alerts = [
    sum.followUpsOverdue && `${sum.followUpsOverdue} seguimiento(s) de casos vencido(s).`,
    sum.activitiesOverdue && `${sum.activitiesOverdue} actividad(es) de programas vencida(s).`,
    sum.psychosocial === "vencida" &&
      "La aplicación de la batería de riesgo psicosocial está vencida.",
    sum.psychosocial === "por_vencer" && "La batería de riesgo psicosocial vence pronto.",
    sum.psychosocial === "sin_aplicar" &&
      "Aún no hay aplicación de la batería de riesgo psicosocial registrada.",
  ].filter(Boolean) as string[];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Vigilancia epidemiológica</h1>
      <Alert>
        Los casos individuales son datos de salud: las notas se guardan cifradas y cada lectura
        queda registrada. No se registra historia clínica.
      </Alert>
      <nav className="flex gap-2">
        <Link
          href="/vigilancia/psicosocial"
          className="min-h-11 rounded-md border px-3 py-2 text-sm"
        >
          Riesgo psicosocial
        </Link>
      </nav>
      {alerts.length > 0 && (
        <Alert variant="warning">
          <ul className="list-disc pl-5 text-sm">
            {alerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Alert>
      )}

      {programs.map((p) => (
        <Card key={p.id}>
          <CardTitle>{p.name}</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            {label(PVE_TYPES, p.type)} · desde {formatDate(p.startedOn)} · {p.openCases} caso(s)
            abierto(s) de {p.totalCases}
          </p>
          {p.objective && <p className="mt-2 text-sm">{p.objective}</p>}
          {p.population && (
            <p className="mt-1 text-sm">
              <strong>Población:</strong> {p.population}
            </p>
          )}
          <ul className="mt-2 divide-y text-sm">
            {p.activities.map((a) => (
              <li key={a.id} className="space-y-2 py-2">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={a.performedOn ? "success" : a.overdue ? "destructive" : "warning"}
                  >
                    {a.performedOn ? "Realizada" : a.overdue ? "Vencida" : "Programada"}
                  </Badge>
                  {a.description}
                  <span className="text-muted-foreground">
                    {formatDate(a.performedOn ?? a.plannedOn)}
                    {a.participants ? ` · ${a.participants} participantes` : ""}
                  </span>
                </p>
                {edit && !a.performedOn && (
                  <details>
                    <summary className="text-primary min-h-11 cursor-pointer py-2">
                      Registrar realización
                    </summary>
                    <ActionForm
                      action={activityDoneAction}
                      idPrefix={`ad-${a.id}-`}
                      hidden={{ id: a.id }}
                      submit="Registrar"
                      variant="outline"
                      fields={[
                        {
                          name: "performedOn",
                          label: "Fecha",
                          type: "date",
                          saved: today,
                          required: true,
                        },
                        { name: "participants", label: "Participantes", type: "number" },
                      ]}
                    />
                  </details>
                )}
              </li>
            ))}
            {p.activities.length === 0 && (
              <li className="text-muted-foreground py-2">Sin actividades.</li>
            )}
          </ul>
          {create && (
            <details className="mt-2">
              <summary className="text-primary min-h-11 cursor-pointer py-2">
                Programar actividad
              </summary>
              <ActionForm
                action={activityAction}
                idPrefix={`na-${p.id}-`}
                hidden={{ programId: p.id }}
                submit="Programar actividad"
                variant="outline"
                fields={[
                  { name: "description", label: "Actividad", required: true },
                  {
                    name: "plannedOn",
                    label: "Fecha prevista",
                    type: "date",
                    saved: today,
                    required: true,
                  },
                ]}
              />
            </details>
          )}
          {edit && (
            <div className="mt-2">
              <RunButton action={closeProgramAction} arg={p.id} confirm="¿Cerrar este programa?">
                Cerrar programa
              </RunButton>
            </div>
          )}
        </Card>
      ))}
      {programs.length === 0 && (
        <Card>
          <p className="text-muted-foreground text-sm">Aún no hay programas de vigilancia.</p>
        </Card>
      )}
      {create && (
        <Card>
          <CardTitle>Nuevo programa</CardTitle>
          <div className="mt-3">
            <ActionForm
              action={programAction}
              idPrefix="np-"
              submit="Crear programa"
              fields={[
                { name: "type", label: "Tipo", type: "select", options: [...PVE_TYPES] },
                { name: "name", label: "Nombre", required: true },
                {
                  name: "startedOn",
                  label: "Fecha de inicio",
                  type: "date",
                  saved: today,
                  required: true,
                },
                { name: "objective", label: "Objetivo", type: "textarea" },
                { name: "population", label: "Población objetivo", type: "textarea" },
              ]}
            />
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>Casos</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {cases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/vigilancia/casos/${c.id}`}
                className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3"
              >
                <span>
                  <span className="font-semibold">{c.workerName}</span>
                  <span className="text-muted-foreground block">
                    {c.program} · abierto {formatDate(c.openedOn)}
                  </span>
                </span>
                <span className="flex gap-2">
                  <Badge
                    variant={
                      c.riskLevel === "high"
                        ? "destructive"
                        : c.riskLevel === "medium"
                          ? "warning"
                          : "success"
                    }
                  >
                    {label(RISK_LEVELS, c.riskLevel)}
                  </Badge>
                  <Badge
                    variant={
                      c.status === "closed"
                        ? "default"
                        : c.followUp === "vencido"
                          ? "destructive"
                          : "warning"
                    }
                  >
                    {c.status === "closed"
                      ? "Cerrado"
                      : c.followUp === "vencido"
                        ? "Seguimiento vencido"
                        : "Abierto"}
                  </Badge>
                </span>
              </Link>
            </li>
          ))}
          {cases.length === 0 && <li className="text-muted-foreground py-2">Sin casos.</li>}
        </ul>
        {create && programs.length > 0 && people.length > 0 && (
          <details className="mt-3">
            <summary className="text-primary min-h-11 cursor-pointer py-2">Abrir un caso</summary>
            <ActionForm
              action={caseAction}
              idPrefix="nc-"
              submit="Abrir caso"
              fields={[
                {
                  name: "programId",
                  label: "Programa",
                  type: "select",
                  options: programs.map((p) => ({ value: p.id, label: p.name })),
                },
                {
                  name: "workerId",
                  label: "Persona",
                  type: "select",
                  options: people.map((p) => ({ value: p.id, label: p.fullName })),
                },
                {
                  name: "openedOn",
                  label: "Fecha de apertura",
                  type: "date",
                  saved: today,
                  required: true,
                },
                {
                  name: "riskLevel",
                  label: "Nivel de riesgo",
                  type: "select",
                  options: [...RISK_LEVELS],
                  saved: "medium",
                },
                { name: "nextFollowUpOn", label: "Próximo seguimiento", type: "date" },
                {
                  name: "notes",
                  label: "Resumen del caso (cifrado; sin historia clínica)",
                  type: "textarea",
                },
              ]}
            />
          </details>
        )}
      </Card>
    </div>
  );
}
