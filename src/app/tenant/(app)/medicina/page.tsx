import Link from "@/components/ui/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { CONCEPTS } from "@/modules/medical/rules";
import {
  evalTypes,
  listAdaptationTasks,
  listEvaluations,
  pendingReturnEvaluations,
  periodicStatus,
} from "@/modules/medical/service";
import { listWorkers } from "@/modules/workers/service";
import { AdaptationForm, ResultForm, ScheduleForm } from "./forms";
import { FormModal } from "@/components/ui/modal";

export const metadata = { title: "Medicina del trabajo" };

export default async function MedicalPage() {
  const ctx = await requirePermission("medical", "view");
  const t = ctx.tenant.tenantId;
  const [evals, periodic, returns, tasks, types, people] = await Promise.all([
    listEvaluations(t),
    periodicStatus(t),
    pendingReturnEvaluations(t),
    listAdaptationTasks(t),
    evalTypes(),
    listWorkers(t, { status: "active" }),
  ]);
  const type = new Map(types.map((x) => [x.code, x.name]));
  const canCreate = can(ctx.permissions, "medical", "create");
  const canEdit = can(ctx.permissions, "medical", "edit");
  const due = periodic.filter((p) => p.state === "vencida" || p.state === "por_vencer");
  const openTasks = tasks.filter((x) => x.status === "open");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Medicina del trabajo</h1>
      <Alert>
        Aquí solo se registran el concepto de aptitud, las restricciones y las recomendaciones. La
        historia clínica no se almacena. Cada consulta de un detalle queda registrada.
      </Alert>
      <nav className="flex gap-2">
        <Link href="/medicina/ausentismo" className="min-h-11 rounded-md border px-3 py-2 text-sm">
          Ausentismo e incapacidades
        </Link>
      </nav>
      {(due.length > 0 || returns.length > 0 || openTasks.some((x) => x.overdue)) && (
        <Card>
          <CardTitle>Alertas</CardTitle>
          <ul className="mt-2 space-y-1 text-sm">
            {due.map((p) => (
              <li key={p.workerId}>
                <Badge variant={p.state === "vencida" ? "destructive" : "warning"}>
                  {p.state === "vencida" ? "Periódica vencida" : "Periódica por vencer"}
                </Badge>{" "}
                {p.name} · {formatDate(p.due)}
              </li>
            ))}
            {returns.map((r) => (
              <li key={r.id}>
                <Badge variant="destructive">Retorno laboral pendiente</Badge> {r.workerName} ·
                ausencia desde {formatDate(r.startDate)}
              </li>
            ))}
            {openTasks
              .filter((x) => x.overdue)
              .map((x) => (
                <li key={x.id}>
                  <Badge variant="destructive">Adaptación vencida</Badge> {x.workerName} ·{" "}
                  {formatDate(x.dueDate)}
                </li>
              ))}
          </ul>
        </Card>
      )}
      {canCreate && (
        <Card>
          <CardTitle>Programar evaluación</CardTitle>
          <div className="mt-3">
            <FormModal
              title="Programar evaluación"
              trigger="Programar evaluación"
              triggerVariant="default"
            >
              <ScheduleForm
                people={people.map((p) => ({ id: p.id, name: p.fullName }))}
                types={types}
              />
            </FormModal>
          </div>
        </Card>
      )}
      {openTasks.length > 0 && (
        <Card>
          <CardTitle>Adaptación del puesto pendiente</CardTitle>
          <ul className="mt-2 divide-y text-sm">
            {openTasks.map((x) => (
              <li key={x.id} className="space-y-2 py-2">
                <p>
                  <span className="font-semibold">{x.workerName}</span> · plazo{" "}
                  {formatDate(x.dueDate)}{" "}
                  {x.overdue && <Badge variant="destructive">Vencida</Badge>}
                </p>
                {canEdit && (
                  <FormModal title="Registrar adaptación" trigger="Registrar adaptación">
                    <AdaptationForm id={x.id} />
                  </FormModal>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <CardTitle>Evaluaciones</CardTitle>
        {evals.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">Aún no hay evaluaciones.</p>
        ) : (
          <ul className="mt-2 divide-y text-sm">
            {evals.map((e) => (
              <li key={e.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/medicina/${e.id}`} className="font-semibold underline">
                    {e.workerName} · {type.get(e.type) ?? e.type}
                  </Link>
                  <span className="flex gap-2">
                    {e.status === "done" ? (
                      <Badge variant="success">
                        {CONCEPTS.find((c) => c.value === e.concept)?.label}
                      </Badge>
                    ) : (
                      <Badge variant="warning">
                        Programada {e.scheduledDate ? formatDate(e.scheduledDate) : ""}
                      </Badge>
                    )}
                  </span>
                </div>
                {e.status === "scheduled" && canEdit && (
                  <FormModal
                    title="Registrar resultado"
                    trigger="Registrar resultado"
                    triggerVariant="default"
                  >
                    <ResultForm evaluationId={e.id} />
                  </FormModal>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
