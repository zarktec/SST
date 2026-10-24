import { ActionForm, RunButton } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { todayYmd } from "@/lib/dates";
import { listWorkCenters } from "@/modules/company/service";
import { ASSET_KINDS, BRIGADE_ROLES, VULNERABILITY } from "@/modules/emergencies/rules";
import {
  emergencySummary,
  listAssets,
  listBrigade,
  listDrills,
  listPlans,
} from "@/modules/emergencies/service";
import { listWorkers } from "@/modules/workers/service";
import {
  assetAction,
  brigadeAction,
  cancelDrillAction,
  drillAction,
  drillResultAction,
  inspectAction,
  planAction,
  removeMemberAction,
  renewAction,
  retireAssetAction,
  trainingAction,
} from "./actions";
import { FormModal } from "@/components/ui/modal";

export const metadata = { title: "Emergencias" };
const label = (list: readonly { value: string; label: string }[], v: string) =>
  list.find((x) => x.value === v)?.label ?? v;
const EXPIRY = {
  vigente: "success",
  por_vencer: "warning",
  vencido: "destructive",
  sin_fecha: "default",
} as const;
const EXPIRY_TXT = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  sin_fecha: "Sin fecha",
} as const;

export default async function EmergenciesPage() {
  const ctx = await requirePermission("emergencies", "view");
  const t = ctx.tenant.tenantId;
  const create = can(ctx.permissions, "emergencies", "create");
  const edit = can(ctx.permissions, "emergencies", "edit");
  const today = todayYmd();
  const [sum, assets, brigade, plans, drills, centers, people] = await Promise.all([
    emergencySummary(t),
    listAssets(t),
    listBrigade(t),
    listPlans(t),
    listDrills(t),
    listWorkCenters(t),
    create && can(ctx.permissions, "workers", "view")
      ? listWorkers(t, { status: "active" })
      : Promise.resolve([]),
  ]);
  const centerOpts = centers.map((c) => ({ value: c.id, label: c.name }));
  const alerts: string[] = [];
  if (!sum.drills.ok)
    alerts.push(`Aún no hay simulacros realizados este año (mínimo ${sum.drills.required}).`);
  if (!sum.hasPlan) alerts.push("No hay plan de emergencias registrado.");
  if (sum.plansDue) alerts.push(`${sum.plansDue} plan(es) de emergencia con revisión vencida.`);
  if (sum.assets.expired) alerts.push(`${sum.assets.expired} equipo(s) vencido(s).`);
  if (sum.assets.expiring) alerts.push(`${sum.assets.expiring} equipo(s) por vencer.`);
  if (sum.assets.inspectionDue)
    alerts.push(`${sum.assets.inspectionDue} equipo(s) con inspección pendiente.`);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Emergencias</h1>
      {alerts.length > 0 && (
        <Alert variant="warning">
          <ul className="list-disc pl-5 text-sm">
            {alerts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Alert>
      )}

      <Card>
        <CardTitle>Simulacros</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {drills.map((d) => (
            <li key={d.id} className="space-y-2 py-3">
              <p className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    d.status === "done" ? "success" : d.status === "planned" ? "warning" : "default"
                  }
                >
                  {d.status === "done"
                    ? "Realizado"
                    : d.status === "planned"
                      ? "Programado"
                      : "Cancelado"}
                </Badge>
                <span className="font-semibold">{d.scenario}</span>
                <span className="text-muted-foreground">
                  {formatDate(d.performedOn ?? d.plannedOn)}
                  {d.center ? ` · ${d.center}` : ""}
                  {d.participants ? ` · ${d.participants} participantes` : ""}
                  {d.evacuationMinutes ? ` · ${d.evacuationMinutes} min` : ""}
                </span>
              </p>
              {d.evaluation && <p className="whitespace-pre-wrap">{d.evaluation}</p>}
              {edit && d.status === "planned" && (
                <FormModal
                  title="Registrar resultado"
                  trigger="Registrar resultado"
                  triggerVariant="default"
                >
                  <ActionForm
                    action={drillResultAction}
                    idPrefix={`dr-${d.id}-`}
                    hidden={{ id: d.id }}
                    submit="Registrar simulacro"
                    fields={[
                      {
                        name: "performedOn",
                        label: "Fecha de realización",
                        type: "date",
                        saved: today,
                        required: true,
                      },
                      { name: "participants", label: "Participantes", type: "number" },
                      { name: "evacuationMinutes", label: "Minutos de evacuación", type: "number" },
                      { name: "responsibleName", label: "Responsable de las mejoras" },
                      { name: "evaluation", label: "Evaluación", type: "textarea" },
                      {
                        name: "improvements",
                        label: "Mejoras (una por línea; cada una crea una acción)",
                        type: "textarea",
                      },
                    ]}
                  />
                  <RunButton
                    action={cancelDrillAction}
                    arg={d.id}
                    confirm="¿Cancelar este simulacro?"
                  >
                    Cancelar simulacro
                  </RunButton>
                </FormModal>
              )}
            </li>
          ))}
          {drills.length === 0 && <li className="text-muted-foreground py-2">Sin simulacros.</li>}
        </ul>
        {create && (
          <div className="mt-3">
            <h3 className="text-sm font-semibold">Programar un simulacro</h3>
            <FormModal
              title="Programar simulacro"
              trigger="Programar simulacro"
              triggerVariant="default"
            >
              <ActionForm
                action={drillAction}
                idPrefix="nd-"
                submit="Programar"
                fields={[
                  { name: "scenario", label: "Escenario", required: true },
                  {
                    name: "plannedOn",
                    label: "Fecha prevista",
                    type: "date",
                    saved: today,
                    required: true,
                  },
                  ...(centers.length > 1
                    ? [
                        {
                          name: "workCenterId",
                          label: "Sede",
                          type: "select" as const,
                          options: centerOpts,
                          empty: "—",
                        },
                      ]
                    : []),
                ]}
              />
            </FormModal>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Plan de prevención, preparación y respuesta</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {plans.map((p) => (
            <li key={p.id} className="py-3">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{p.center ?? "General"}</span>
                <Badge
                  variant={
                    p.vulnerability === "high"
                      ? "destructive"
                      : p.vulnerability === "medium"
                        ? "warning"
                        : "success"
                  }
                >
                  Vulnerabilidad {label(VULNERABILITY, p.vulnerability).toLowerCase()}
                </Badge>
                <Badge variant={p.reviewDue ? "destructive" : "default"}>
                  Revisar antes de {formatDate(p.nextReviewOn)}
                </Badge>
              </p>
              <p className="mt-1 whitespace-pre-wrap">{p.vulnerabilityAnalysis}</p>
              {p.pon && (
                <p className="mt-1 whitespace-pre-wrap">
                  <strong>PON:</strong> {p.pon}
                </p>
              )}
              {p.evacuationRoutes && (
                <p className="mt-1 whitespace-pre-wrap">
                  <strong>Rutas de evacuación:</strong> {p.evacuationRoutes}
                </p>
              )}
            </li>
          ))}
          {plans.length === 0 && <li className="text-muted-foreground py-2">Sin plan.</li>}
        </ul>
        {edit && (
          <FormModal
            title="Crear o actualizar un plan"
            trigger="Crear o actualizar un plan"
            triggerVariant="default"
            triggerClassName="mt-3"
          >
            <ActionForm
              action={planAction}
              idPrefix="pl-"
              submit="Guardar plan"
              fields={[
                ...(centers.length > 1
                  ? [
                      {
                        name: "workCenterId",
                        label: "Sede (vacío = plan general)",
                        type: "select" as const,
                        options: centerOpts,
                        empty: "General",
                      },
                    ]
                  : []),
                {
                  name: "vulnerability",
                  label: "Nivel de vulnerabilidad",
                  type: "select",
                  options: [...VULNERABILITY],
                },
                {
                  name: "reviewedOn",
                  label: "Fecha de revisión",
                  type: "date",
                  saved: today,
                  required: true,
                },
                {
                  name: "vulnerabilityAnalysis",
                  label: "Análisis de vulnerabilidad",
                  type: "textarea",
                  rows: 4,
                },
                {
                  name: "pon",
                  label: "Procedimientos operativos normalizados (PON)",
                  type: "textarea",
                  rows: 4,
                },
                {
                  name: "evacuationRoutes",
                  label: "Rutas de evacuación y puntos de encuentro",
                  type: "textarea",
                },
              ]}
            />
            <p className="text-muted-foreground text-xs">
              Los planos se podrán adjuntar cuando se habilite el almacenamiento de archivos.
            </p>
          </FormModal>
        )}
      </Card>

      <Card>
        <CardTitle>Equipos de emergencia</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {assets.map((a) => (
            <li key={a.id} className="space-y-2 py-3">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">
                  {label(ASSET_KINDS, a.kind)} {a.code}
                </span>
                <span className="text-muted-foreground">{a.location}</span>
                <Badge variant={EXPIRY[a.expiry]}>
                  {EXPIRY_TXT[a.expiry]}
                  {a.expiresOn ? ` · ${formatDate(a.expiresOn)}` : ""}
                </Badge>
                <Badge variant={a.inspection === "al_dia" ? "success" : "warning"}>
                  {a.inspection === "al_dia"
                    ? `Inspeccionado ${formatDate(a.lastInspectedOn!)}`
                    : a.inspection === "vencida"
                      ? "Inspección vencida"
                      : "Sin inspección"}
                </Badge>
              </p>
              {edit && (
                <FormModal title="Inspeccionar o renovar" trigger="Inspeccionar o renovar">
                  <div className="space-y-3">
                    <ActionForm
                      action={inspectAction}
                      idPrefix={`in-${a.id}-`}
                      hidden={{ id: a.id }}
                      submit="Registrar inspección"
                      variant="outline"
                      fields={[
                        {
                          name: "performedOn",
                          label: "Fecha",
                          type: "date",
                          saved: today,
                          required: true,
                        },
                        { name: "ok", label: "Está en buen estado", type: "checkbox", saved: true },
                        { name: "note", label: "Observación" },
                      ]}
                    />
                    <ActionForm
                      action={renewAction}
                      idPrefix={`rn-${a.id}-`}
                      hidden={{ id: a.id }}
                      submit="Actualizar vigencia"
                      variant="outline"
                      fields={[
                        {
                          name: "expiresOn",
                          label: "Nueva fecha de vencimiento",
                          type: "date",
                          required: true,
                        },
                      ]}
                    />
                    <RunButton
                      action={retireAssetAction}
                      arg={a.id}
                      confirm="¿Retirar este equipo del inventario?"
                    >
                      Retirar equipo
                    </RunButton>
                  </div>
                </FormModal>
              )}
            </li>
          ))}
          {assets.length === 0 && (
            <li className="text-muted-foreground py-2">Sin equipos registrados.</li>
          )}
        </ul>
        {create && (
          <FormModal
            title="Agregar equipo"
            trigger="Agregar equipo"
            triggerVariant="default"
            triggerClassName="mt-3"
          >
            <ActionForm
              action={assetAction}
              idPrefix="na-"
              submit="Agregar equipo"
              fields={[
                { name: "kind", label: "Tipo", type: "select", options: [...ASSET_KINDS] },
                { name: "code", label: "Código o rótulo", required: true },
                { name: "location", label: "Ubicación", required: true },
                { name: "expiresOn", label: "Vence (recarga o contenido)", type: "date" },
                { name: "detail", label: "Detalle (agente, capacidad…)" },
                ...(centers.length > 1
                  ? [
                      {
                        name: "workCenterId",
                        label: "Sede",
                        type: "select" as const,
                        options: centerOpts,
                        empty: "—",
                      },
                    ]
                  : []),
              ]}
            />
          </FormModal>
        )}
      </Card>

      <Card>
        <CardTitle>Brigada de emergencias</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {brigade.map((m) => (
            <li key={m.id} className="space-y-2 py-3">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{m.name}</span>
                <Badge>{label(BRIGADE_ROLES, m.role)}</Badge>
                <span className="text-muted-foreground">
                  {m.lastTrainingOn
                    ? `Capacitado ${formatDate(m.lastTrainingOn)}`
                    : "Sin capacitación registrada"}
                  {m.dotation ? ` · Dotación: ${m.dotation}` : ""}
                </span>
              </p>
              {edit && (
                <FormModal title="Capacitación o retiro" trigger="Capacitación o retiro">
                  <ActionForm
                    action={trainingAction}
                    idPrefix={`tr-${m.id}-`}
                    hidden={{ id: m.id }}
                    submit="Registrar capacitación"
                    variant="outline"
                    fields={[
                      {
                        name: "lastTrainingOn",
                        label: "Fecha de la capacitación",
                        type: "date",
                        saved: today,
                        required: true,
                      },
                    ]}
                  />
                  <RunButton
                    action={removeMemberAction}
                    arg={m.id}
                    confirm="¿Retirar a esta persona de la brigada?"
                  >
                    Retirar de la brigada
                  </RunButton>
                </FormModal>
              )}
            </li>
          ))}
          {brigade.length === 0 && <li className="text-muted-foreground py-2">Sin integrantes.</li>}
        </ul>
        {create && people.length > 0 && (
          <FormModal
            title="Agregar integrante"
            trigger="Agregar integrante"
            triggerVariant="default"
            triggerClassName="mt-3"
          >
            <ActionForm
              action={brigadeAction}
              idPrefix="nb-"
              submit="Agregar a la brigada"
              fields={[
                {
                  name: "workerId",
                  label: "Persona",
                  type: "select",
                  options: people.map((p) => ({ value: p.id, label: p.fullName })),
                },
                { name: "role", label: "Rol", type: "select", options: [...BRIGADE_ROLES] },
                {
                  name: "joinedOn",
                  label: "Ingreso a la brigada",
                  type: "date",
                  saved: today,
                  required: true,
                },
                { name: "lastTrainingOn", label: "Última capacitación", type: "date" },
                { name: "dotation", label: "Dotación entregada" },
              ]}
            />
          </FormModal>
        )}
      </Card>
    </div>
  );
}
