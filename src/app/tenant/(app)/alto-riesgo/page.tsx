import { ActionForm, RunButton, type FieldSpec } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { todayYmd } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { listWorkCenters } from "@/modules/company/service";
import { KINDS, checklistToText } from "@/modules/high-risk/rules";
import {
  highRiskSummary,
  listCertificates,
  listEquipment,
  listPermits,
  listTypes,
  permitBlockers,
} from "@/modules/high-risk/service";
import { listWorkers } from "@/modules/workers/service";
import {
  authorizeAction,
  cancelAction,
  certificateAction,
  closeAction,
  defaultTypesAction,
  equipmentAction,
  equipmentUpdateAction,
  requestAction,
  retireEquipmentAction,
  toggleTypeAction,
  typeAction,
} from "./actions";

export const metadata = { title: "Tareas de alto riesgo" };
const STATE = {
  solicitado: ["warning", "Pendiente de autorizar"],
  programado: ["default", "Autorizado · programado"],
  vigente: ["success", "Vigente"],
  vencido: ["destructive", "Vencido sin cerrar"],
  cerrado: ["default", "Cerrado"],
  cancelado: ["default", "Cancelado"],
} as const;
const EXP = {
  vigente: "success",
  por_vencer: "warning",
  vencido: "destructive",
  sin_fecha: "default",
} as const;
const EXP_TXT = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencido: "Vencido",
  sin_fecha: "Sin fecha",
} as const;
const fmtTime = (d: Date) =>
  new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Bogota",
  }).format(d);

export default async function HighRiskPage({ searchParams }: PageProps<"/tenant/alto-riesgo">) {
  const ctx = await requirePermission("high_risk", "view");
  const sp = await searchParams;
  const t = ctx.tenant.tenantId;
  const create = can(ctx.permissions, "high_risk", "create");
  const edit = can(ctx.permissions, "high_risk", "edit");
  const approve = can(ctx.permissions, "high_risk", "approve");
  const today = todayYmd();
  const [sum, types, permits, certs, equipment, centers, people] = await Promise.all([
    highRiskSummary(t),
    listTypes(t),
    listPermits(t),
    listCertificates(t),
    listEquipment(t),
    listWorkCenters(t),
    can(ctx.permissions, "workers", "view")
      ? listWorkers(t, { status: "active" })
      : Promise.resolve([]),
  ]);
  const activeTypes = types.filter((x) => x.active);
  const chosen = activeTypes.find((x) => x.id === sp.tipo);
  const open = permits.filter((p) => p.state === "solicitado");
  const blockers = new Map(
    await Promise.all(open.map(async (p) => [p.id, await permitBlockers(t, p.id)] as const)),
  );
  const workerOpts = people.map((p) => ({ value: p.id, label: p.fullName }));
  const alerts = [
    sum.toAuthorize && `${sum.toAuthorize} permiso(s) pendiente(s) de autorizar.`,
    sum.toClose && `${sum.toClose} permiso(s) vencido(s) sin cerrar.`,
    sum.certsExpired && `${sum.certsExpired} certificado(s) de alturas vencido(s).`,
    sum.certsExpiring && `${sum.certsExpiring} certificado(s) de alturas por vencer.`,
    sum.equipmentExpired &&
      `${sum.equipmentExpired} equipo(s) de alturas con certificación vencida.`,
    sum.equipmentExpiring && `${sum.equipmentExpiring} equipo(s) de alturas por vencer.`,
  ].filter(Boolean) as string[];
  const requestFields: FieldSpec[] = chosen
    ? [
        { name: "place", label: "Lugar", required: true },
        ...(centers.length > 1
          ? [
              {
                name: "workCenterId",
                label: "Sede",
                type: "select" as const,
                options: centers.map((c) => ({ value: c.id, label: c.name })),
                empty: "—",
              },
            ]
          : []),
        { name: "date", label: "Fecha del trabajo", type: "date", saved: today, required: true },
        { name: "fromTime", label: "Desde", type: "time", saved: "08:00", required: true },
        { name: "toTime", label: "Hasta", type: "time", saved: "12:00", required: true },
        { name: "description", label: "Trabajo a realizar", type: "textarea" },
        ...chosen.checklist.map((c) => ({
          name: `c_${c.id}`,
          label: `${c.text}${c.required ? " *" : ""}`,
          type: "select" as const,
          options: [
            { value: "ok", label: "Cumple" },
            { value: "fail", label: "No cumple" },
            { value: "na", label: "No aplica" },
          ],
          empty: "Sin responder",
        })),
        ...(chosen.requiresCertificate
          ? [
              {
                name: "coordinatorWorkerId",
                label: "Coordinador de trabajo en alturas",
                type: "select" as const,
                options: workerOpts,
                empty: "Selecciona",
              },
            ]
          : []),
        ...(chosen.requiresRescuePlan
          ? [{ name: "rescuePlan", label: "Plan de rescate", type: "textarea" as const }]
          : []),
        ...workerOpts.map((w) => ({
          name: `w_${w.value}`,
          label: `Trabaja: ${w.label}`,
          type: "checkbox" as const,
        })),
        { name: "signature", label: "Firma del solicitante", type: "signature" as const },
      ]
    : [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Tareas de alto riesgo</h1>
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
        <CardTitle>Permisos de trabajo</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {permits.map((p) => {
            const [variant, txt] = STATE[p.state];
            const bl = blockers.get(p.id) ?? [];
            return (
              <li key={p.id} className="space-y-2 py-3">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge variant={variant}>{txt}</Badge>
                  <span className="font-semibold">{p.typeName}</span>
                  <span className="text-muted-foreground">
                    {p.place} · {fmtTime(p.validFrom)} a {fmtTime(p.validUntil)}
                  </span>
                </p>
                <p>{p.description}</p>
                <p className="text-muted-foreground">
                  Personas: {p.workers.map((w) => w.name).join(", ") || "—"} · Solicita{" "}
                  {p.requestedName}
                  {p.authorizedName ? ` · Autoriza ${p.authorizedName}` : ""}
                </p>
                {p.closeNote && <p>Cierre: {p.closeNote}</p>}
                {p.cancelReason && <p>Cancelado: {p.cancelReason}</p>}
                {p.state === "solicitado" && bl.length > 0 && (
                  <Alert variant="warning">
                    <p className="text-sm font-semibold">Para autorizar falta:</p>
                    <ul className="list-disc pl-5 text-sm">
                      {bl.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </Alert>
                )}
                {p.state === "solicitado" &&
                  approve &&
                  p.requestedBy !== ctx.user.id &&
                  bl.length === 0 && (
                    <details>
                      <summary className="text-primary min-h-11 cursor-pointer py-2">
                        Autorizar con mi firma
                      </summary>
                      <ActionForm
                        action={authorizeAction}
                        idPrefix={`au-${p.id}-`}
                        hidden={{ id: p.id }}
                        submit="Autorizar permiso"
                        fields={[
                          {
                            name: "signature",
                            label: "Firma de quien autoriza",
                            type: "signature",
                          },
                        ]}
                      />
                    </details>
                  )}
                {edit &&
                  (p.state === "vigente" || p.state === "vencido" || p.state === "programado") && (
                    <details>
                      <summary className="text-primary min-h-11 cursor-pointer py-2">
                        Cerrar el permiso
                      </summary>
                      <ActionForm
                        action={closeAction}
                        idPrefix={`cl-${p.id}-`}
                        hidden={{ id: p.id }}
                        submit="Cerrar permiso"
                        fields={[{ name: "note", label: "Novedades al cierre", type: "textarea" }]}
                      />
                    </details>
                  )}
                {edit &&
                  (p.state === "solicitado" ||
                    p.state === "programado" ||
                    p.state === "vigente") && (
                    <details>
                      <summary className="text-primary min-h-11 cursor-pointer py-2">
                        Cancelar
                      </summary>
                      <ActionForm
                        action={cancelAction}
                        idPrefix={`ca-${p.id}-`}
                        hidden={{ id: p.id }}
                        submit="Cancelar permiso"
                        variant="outline"
                        fields={[{ name: "reason", label: "Motivo" }]}
                      />
                    </details>
                  )}
              </li>
            );
          })}
          {permits.length === 0 && <li className="text-muted-foreground py-2">Sin permisos.</li>}
        </ul>
      </Card>

      {create && (
        <Card>
          <CardTitle>Solicitar un permiso</CardTitle>
          {activeTypes.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-sm">
              Aún no hay tipos de permiso{edit ? ": créalos más abajo." : "."}
            </p>
          ) : (
            <nav className="mt-2 flex flex-wrap gap-2" aria-label="Tipo de permiso">
              {activeTypes.map((x) => (
                <a
                  key={x.id}
                  href={`/alto-riesgo?tipo=${x.id}`}
                  className={`min-h-11 rounded-md border px-3 py-2 text-sm ${x.id === chosen?.id ? "bg-primary text-primary-foreground" : ""}`}
                >
                  {x.name}
                </a>
              ))}
            </nav>
          )}
          {chosen && (
            <div className="mt-3">
              <ActionForm
                action={requestAction}
                idPrefix="rq-"
                hidden={{ typeId: chosen.id }}
                submit="Solicitar permiso"
                fields={requestFields}
              />
            </div>
          )}
        </Card>
      )}

      <Card>
        <CardTitle>Certificados de trabajo en alturas</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {certs
            .filter((c) => c.current)
            .map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="font-semibold">{c.name}</span>
                <Badge>{c.level === "coordinator" ? "Coordinador" : "Autorizado"}</Badge>
                <Badge variant={EXP[c.state]}>
                  {EXP_TXT[c.state]} · {formatDate(c.expiresOn)}
                </Badge>
                <span className="text-muted-foreground">{c.issuer}</span>
              </li>
            ))}
          {certs.length === 0 && <li className="text-muted-foreground py-2">Sin certificados.</li>}
        </ul>
        {create && workerOpts.length > 0 && (
          <details className="mt-3">
            <summary className="text-primary min-h-11 cursor-pointer py-2">
              Registrar certificado
            </summary>
            <ActionForm
              action={certificateAction}
              idPrefix="ce-"
              submit="Registrar certificado"
              fields={[
                { name: "workerId", label: "Persona", type: "select", options: workerOpts },
                {
                  name: "level",
                  label: "Nivel",
                  type: "select",
                  options: [
                    { value: "authorized", label: "Trabajador autorizado" },
                    { value: "coordinator", label: "Coordinador" },
                  ],
                },
                { name: "issuer", label: "Entidad que certificó", required: true },
                {
                  name: "issuedOn",
                  label: "Fecha de expedición",
                  type: "date",
                  saved: today,
                  required: true,
                },
                {
                  name: "expiresOn",
                  label: "Vence (vacío = según la vigencia parametrizada)",
                  type: "date",
                },
              ]}
            />
          </details>
        )}
      </Card>

      <Card>
        <CardTitle>Equipos certificados (protección contra caídas y rescate)</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {equipment.map((e) => (
            <li key={e.id} className="space-y-2 py-3">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{e.code}</span> {e.description}
                <Badge variant={EXP[e.state]}>
                  {EXP_TXT[e.state]}
                  {e.certifiedUntil ? ` · ${formatDate(e.certifiedUntil)}` : ""}
                </Badge>
              </p>
              {edit && (
                <details>
                  <summary className="text-primary min-h-11 cursor-pointer py-2">
                    Actualizar o retirar
                  </summary>
                  <ActionForm
                    action={equipmentUpdateAction}
                    idPrefix={`eu-${e.id}-`}
                    hidden={{ id: e.id }}
                    submit="Actualizar"
                    variant="outline"
                    fields={[
                      {
                        name: "certifiedUntil",
                        label: "Nueva vigencia de la certificación",
                        type: "date",
                      },
                      { name: "lastInspectedOn", label: "Última inspección", type: "date" },
                    ]}
                  />
                  <RunButton
                    action={retireEquipmentAction}
                    arg={e.id}
                    confirm="¿Retirar este equipo?"
                  >
                    Retirar equipo
                  </RunButton>
                </details>
              )}
            </li>
          ))}
          {equipment.length === 0 && <li className="text-muted-foreground py-2">Sin equipos.</li>}
        </ul>
        {create && (
          <details className="mt-3">
            <summary className="text-primary min-h-11 cursor-pointer py-2">Agregar equipo</summary>
            <ActionForm
              action={equipmentAction}
              idPrefix="eq-"
              submit="Agregar equipo"
              fields={[
                { name: "code", label: "Código", required: true },
                {
                  name: "description",
                  label: "Descripción (arnés, línea de vida…)",
                  required: true,
                },
                { name: "certifiedUntil", label: "Certificación vigente hasta", type: "date" },
              ]}
            />
          </details>
        )}
      </Card>

      {edit && (
        <Card>
          <CardTitle>Tipos de permiso</CardTitle>
          <p className="text-muted-foreground mt-1 text-xs">
            Las listas de verificación predeterminadas son provisionales: ajústalas con tu experto
            SST antes de usarlas.
          </p>
          {types.length === 0 && (
            <div className="mt-2">
              <RunButton action={defaultTypesAction} arg="" variant="default">
                Crear los tipos predeterminados
              </RunButton>
            </div>
          )}
          <ul className="mt-2 divide-y text-sm">
            {types.map((x) => (
              <li key={x.id} className="space-y-2 py-3">
                <p className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {x.name} {!x.active && <Badge>Inactivo</Badge>}
                  </span>
                  <RunButton action={toggleTypeAction} arg={x.id}>
                    {x.active ? "Desactivar" : "Activar"}
                  </RunButton>
                </p>
                <details>
                  <summary className="text-primary min-h-11 cursor-pointer py-2">Editar</summary>
                  <ActionForm
                    action={typeAction}
                    idPrefix={`ty-${x.id}-`}
                    hidden={{ id: x.id }}
                    submit="Guardar tipo"
                    fields={[
                      { name: "name", label: "Nombre", saved: x.name },
                      {
                        name: "kind",
                        label: "Clase",
                        type: "select",
                        options: [...KINDS],
                        saved: x.kind,
                      },
                      {
                        name: "maxHours",
                        label: "Duración máxima (horas)",
                        type: "number",
                        saved: x.maxHours,
                      },
                      {
                        name: "requiresCertificate",
                        label: "Exige certificado de alturas y coordinador",
                        type: "checkbox",
                        saved: x.requiresCertificate,
                      },
                      {
                        name: "requiresRescuePlan",
                        label: "Exige plan de rescate",
                        type: "checkbox",
                        saved: x.requiresRescuePlan,
                      },
                      {
                        name: "itemsText",
                        label: "Lista de verificación (uno por línea; * = obligatorio)",
                        type: "textarea",
                        rows: 6,
                        saved: checklistToText(x.checklist),
                      },
                    ]}
                  />
                </details>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
