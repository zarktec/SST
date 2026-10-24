import { ActionForm, RunButton, type FieldSpec } from "@/components/forms/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { todayYmd } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { listReviews } from "@/modules/audits/service";
import {
  createReviewAction,
  refreshInputsAction,
  saveReviewAction,
  signReviewAction,
} from "./actions";

export const metadata = { title: "Revisión por la dirección" };
const fmt = (v: number | null) =>
  v === null ? "—" : new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(v);

export default async function ReviewPage() {
  const ctx = await requirePermission("management_review", "view");
  const t = ctx.tenant.tenantId;
  const create = can(ctx.permissions, "management_review", "create");
  const edit = can(ctx.permissions, "management_review", "edit");
  const approve = can(ctx.permissions, "management_review", "approve");
  const today = todayYmd();
  const year = Number(today.slice(0, 4));
  const reviews = await listReviews(t);
  const manual = (r?: (typeof reviews)[number]): FieldSpec[] => [
    {
      name: "heldOn",
      label: "Fecha de la reunión",
      type: "date",
      saved: r?.heldOn ?? today,
      required: true,
    },
    { name: "attendees", label: "Asistentes", saved: r?.attendees },
    {
      name: "legalChanges",
      label: "Cambios en el entorno legal",
      type: "textarea",
      saved: r?.legalChanges,
    },
    {
      name: "stakeholderComms",
      label: "Comunicaciones de las partes interesadas",
      type: "textarea",
      saved: r?.stakeholderComms,
    },
    {
      name: "objectivesCompliance",
      label: "Cumplimiento de objetivos y metas",
      type: "textarea",
      saved: r?.objectivesCompliance,
    },
    {
      name: "conclusions",
      label: "Conclusiones (conveniencia, adecuación y eficacia del sistema)",
      type: "textarea",
      rows: 4,
      saved: r?.conclusions,
    },
    {
      name: "decisions",
      label: "Decisiones (una por línea; cada una crea una acción de mejora)",
      type: "textarea",
      rows: 4,
      saved: r?.decisions,
    },
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Revisión por la alta dirección</h1>
      <p className="text-muted-foreground text-sm">
        Las entradas del sistema se capturan al crear la revisión; la alta dirección las
        complementa, registra conclusiones y decisiones, y firma. Firmada queda inmodificable.
      </p>
      {reviews.map((r) => (
        <Card key={r.id}>
          <CardTitle>Revisión {r.year}</CardTitle>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <Badge variant={r.status === "signed" ? "success" : "warning"}>
              {r.status === "signed" ? "Firmada" : "Borrador"}
            </Badge>
            <span className="text-muted-foreground">
              {formatDate(r.heldOn)} · {r.attendees}
              {r.signedName ? ` · firmó ${r.signedName}` : ""}
            </span>
          </p>
          <details className="mt-2" open>
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
              Entradas del sistema
            </summary>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>
                Accidentalidad {r.year}: {r.inputs.accidents.total} accidente(s),{" "}
                {r.inputs.accidents.fatal} mortal(es), {r.inputs.accidents.incidents} incidente(s).
              </li>
              {r.inputs.indicators.map((i) => (
                <li key={i.name}>
                  {i.name}: {fmt(i.value)}
                  {i.target !== null ? ` (meta ${fmt(i.target)})` : ""}
                </li>
              ))}
              <li>
                Auditorías:{" "}
                {r.inputs.audits.length
                  ? r.inputs.audits
                      .map(
                        (a) =>
                          `${a.title} (${a.status === "closed" ? "cerrada" : "abierta"}, ${a.findings} hallazgo(s))`,
                      )
                      .join("; ")
                  : "ninguna"}
                .
              </li>
              <li>
                Acciones: {r.inputs.actions.open} abiertas, {r.inputs.actions.overdue} vencidas,{" "}
                {r.inputs.actions.awaitingVerification} por verificar.
              </li>
              <li>
                Autoevaluación de estándares:{" "}
                {r.inputs.standards
                  ? `${r.inputs.standards.year}: ${fmt(r.inputs.standards.scorePct)}% (${r.inputs.standards.level ?? "—"})`
                  : "sin autoevaluación cerrada"}
                .
              </li>
              <li>
                Plan anual:{" "}
                {r.inputs.annualPlan
                  ? `${r.inputs.annualPlan.done} de ${r.inputs.annualPlan.total} actividades (${fmt(r.inputs.annualPlan.pct)}%)`
                  : "sin plan del año"}
                .
              </li>
            </ul>
            <p className="text-muted-foreground mt-1 text-xs">
              Capturadas el {formatDate(r.inputs.generatedAt.slice(0, 10))}.
            </p>
          </details>
          {r.status === "signed" ? (
            <div className="mt-2 space-y-1 text-sm">
              {r.legalChanges && (
                <p>
                  <strong>Cambios legales:</strong> {r.legalChanges}
                </p>
              )}
              {r.stakeholderComms && (
                <p>
                  <strong>Partes interesadas:</strong> {r.stakeholderComms}
                </p>
              )}
              {r.objectivesCompliance && (
                <p>
                  <strong>Objetivos y metas:</strong> {r.objectivesCompliance}
                </p>
              )}
              <p className="whitespace-pre-wrap">
                <strong>Conclusiones:</strong> {r.conclusions}
              </p>
              <p className="whitespace-pre-wrap">
                <strong>Decisiones:</strong> {r.decisions}
              </p>
              <p className="text-muted-foreground text-xs">
                Huella de evidencia: {r.evidenceHash?.slice(0, 16)}…
              </p>
            </div>
          ) : (
            <>
              {edit && (
                <details className="mt-2" open>
                  <summary className="text-primary min-h-11 cursor-pointer py-2">
                    Completar la revisión
                  </summary>
                  <ActionForm
                    action={saveReviewAction}
                    idPrefix={`rv-${r.id}-`}
                    hidden={{ id: r.id }}
                    submit="Guardar revisión"
                    fields={manual(r)}
                  />
                  <RunButton action={refreshInputsAction} arg={r.id}>
                    Actualizar entradas del sistema
                  </RunButton>
                </details>
              )}
              {approve && (
                <details className="mt-2">
                  <summary className="text-primary min-h-11 cursor-pointer py-2">
                    Firmar (alta dirección)
                  </summary>
                  <ActionForm
                    action={signReviewAction}
                    idPrefix={`sg-${r.id}-`}
                    hidden={{ id: r.id }}
                    submit="Firmar revisión"
                    fields={[
                      {
                        name: "responsibleName",
                        label: "Responsable de las acciones de las decisiones",
                      },
                      { name: "dueDate", label: "Fecha límite de las acciones", type: "date" },
                      { name: "signature", label: "Firma de la alta dirección", type: "signature" },
                    ]}
                  />
                </details>
              )}
            </>
          )}
        </Card>
      ))}
      {create && (
        <Card>
          <CardTitle>Nueva revisión</CardTitle>
          <div className="mt-3">
            <ActionForm
              action={createReviewAction}
              idPrefix="nr-"
              hidden={{ year: String(year) }}
              submit={`Crear la revisión ${year}`}
              fields={manual()}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
