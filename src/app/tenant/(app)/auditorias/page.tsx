import { ActionForm, RunButton, type FieldSpec } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { todayYmd } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { RESULTS } from "@/modules/audits/rules";
import { auditProgram, listAudits } from "@/modules/audits/service";
import { cancelAuditAction, closeAuditAction, createAuditAction, saveAuditAction } from "./actions";
import { FormModal } from "@/components/ui/modal";

export const metadata = { title: "Auditoría interna" };
const STATUS = {
  planned: ["warning", "Programada"],
  in_progress: ["warning", "En curso"],
  closed: ["success", "Cerrada"],
  cancelled: ["default", "Cancelada"],
} as const;

export default async function AuditsPage() {
  const ctx = await requirePermission("audits", "view");
  const t = ctx.tenant.tenantId;
  const create = can(ctx.permissions, "audits", "create");
  const edit = can(ctx.permissions, "audits", "edit");
  const approve = can(ctx.permissions, "audits", "approve");
  const today = todayYmd();
  const year = Number(today.slice(0, 4));
  const [audits, program] = await Promise.all([listAudits(t), auditProgram(t, year)]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Auditoría interna del SG-SST</h1>
      {program.closed === 0 && (
        <Alert variant="warning">
          {program.planned
            ? `Hay ${program.planned} auditoría(s) del ${year} sin cerrar${program.overdue ? ` (${program.overdue} atrasada(s))` : ""}.`
            : `No hay auditoría programada para ${year}.`}
        </Alert>
      )}
      {audits.map((a) => {
        const [variant, txt] = STATUS[a.status as keyof typeof STATUS];
        const open = a.status === "planned" || a.status === "in_progress";
        const fields: FieldSpec[] = [
          {
            name: "performedOn",
            label: "Fecha de realización",
            type: "date",
            saved: a.performedOn ?? today,
            required: true,
          },
          { name: "auditorName", label: "Auditor", saved: a.auditorName },
          {
            name: "committeeParticipant",
            label: "Participante del COPASST / Vigía",
            saved: a.committeeParticipant,
          },
          ...a.checklist.flatMap((i) => [
            {
              name: `r_${i.id}`,
              label: i.text,
              type: "select" as const,
              options: [...RESULTS],
              empty: "Sin evaluar",
              saved: i.result,
            },
            { name: `n_${i.id}`, label: `Hallazgo o nota: ${i.text}`, saved: i.note },
          ]),
          {
            name: "report",
            label: "Informe de auditoría",
            type: "textarea",
            rows: 5,
            saved: a.report,
          },
        ];
        return (
          <Card key={a.id}>
            <CardTitle>{a.title}</CardTitle>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={variant}>{txt}</Badge>
              {a.overdue && <Badge variant="destructive">Atrasada</Badge>}
              <span className="text-muted-foreground">
                Prevista {formatDate(a.plannedOn)}
                {a.performedOn ? ` · realizada ${formatDate(a.performedOn)}` : ""}
                {a.auditorName ? ` · auditor ${a.auditorName}` : ""}
                {a.committeeParticipant ? ` · COPASST/Vigía: ${a.committeeParticipant}` : ""}
              </span>
            </p>
            {a.scope && <p className="mt-1 text-sm">{a.scope}</p>}
            {a.status === "closed" && (
              <div className="mt-2 space-y-2 text-sm">
                <p className="whitespace-pre-wrap">{a.report}</p>
                <ul className="divide-y">
                  {a.checklist.map((i) => (
                    <li key={i.id} className="py-1">
                      <Badge
                        variant={
                          i.result === "conforms"
                            ? "success"
                            : i.result === "na"
                              ? "default"
                              : i.result === "observation"
                                ? "warning"
                                : "destructive"
                        }
                      >
                        {RESULTS.find((r) => r.value === i.result)?.label}
                      </Badge>{" "}
                      {i.text}
                      {i.note && <span className="text-muted-foreground"> — {i.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {open && edit && (
              <FormModal
                title="Ejecutar la auditoría"
                trigger="Ejecutar la auditoría"
                triggerClassName="mt-2"
              >
                <ActionForm
                  action={saveAuditAction}
                  idPrefix={`ex-${a.id}-`}
                  hidden={{ id: a.id }}
                  submit="Guardar avance"
                  fields={fields}
                />
              </FormModal>
            )}
            {open && a.blockers.length > 0 && a.status === "in_progress" && (
              <Alert variant="warning">
                <p className="text-sm font-semibold">Para cerrar falta:</p>
                <ul className="list-disc pl-5 text-sm">
                  {a.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </Alert>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {open && approve && a.status === "in_progress" && a.blockers.length === 0 && (
                <RunButton
                  action={closeAuditAction}
                  arg={a.id}
                  variant="default"
                  confirm="Se cerrará la auditoría y los hallazgos se convertirán en acciones. ¿Continuar?"
                >
                  Cerrar auditoría
                </RunButton>
              )}
              {a.status === "planned" && edit && (
                <RunButton
                  action={cancelAuditAction}
                  arg={a.id}
                  confirm="¿Cancelar esta auditoría?"
                >
                  Cancelar
                </RunButton>
              )}
            </div>
          </Card>
        );
      })}
      {audits.length === 0 && (
        <Card>
          <p className="text-muted-foreground text-sm">Aún no hay auditorías.</p>
        </Card>
      )}
      {create && (
        <Card>
          <CardTitle>Programar una auditoría</CardTitle>
          <div className="mt-3">
            <FormModal
              title="Programar auditoría"
              trigger="Programar auditoría"
              triggerVariant="default"
            >
              <ActionForm
                action={createAuditAction}
                idPrefix="na-"
                submit="Programar auditoría"
                fields={[
                  { name: "title", label: "Nombre", required: true },
                  {
                    name: "plannedOn",
                    label: "Fecha prevista",
                    type: "date",
                    saved: today,
                    required: true,
                  },
                  { name: "scope", label: "Alcance", type: "textarea", rows: 2 },
                  {
                    name: "itemsText",
                    label: "Lista de verificación (un ítem por línea)",
                    type: "textarea",
                    rows: 5,
                  },
                  {
                    name: "fromAssessment",
                    label:
                      "Si dejo la lista vacía, usar los criterios de la última autoevaluación de estándares",
                    type: "checkbox",
                  },
                ]}
              />
            </FormModal>
          </div>
        </Card>
      )}
    </div>
  );
}
