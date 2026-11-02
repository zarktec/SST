import { notFound } from "next/navigation";
import { ActionForm, RunButton, type FieldSpec } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import Link from "@/components/ui/link";
import { FormModal } from "@/components/ui/modal";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { LEVELS, levelLabel } from "@/modules/performance/rules";
import { cycleDetail, cycleResults, listCycles, workerOfUser } from "@/modules/performance/service";
import { listWorkers } from "@/modules/workers/service";
import {
  assignmentAction,
  closeCycleAction,
  removeAssignmentAction,
  subjectAction,
} from "../../actions";
import { ResultsView } from "../../results-view";

export const metadata = { title: "Ciclo de evaluación 360" };

export default async function CyclePage({ params }: PageProps<"/tenant/desempeno/ciclos/[id]">) {
  const ctx = await requirePermission("performance", "view");
  const t = ctx.tenant.tenantId;
  const id = (await params).id;
  const manage = ctx.scope === "all";

  // Persona evaluada: solo ve lo suyo y solo con el ciclo cerrado.
  if (!manage) {
    const me = await workerOfUser(t, ctx.user.email);
    if (!me) notFound();
    const r = await cycleResults(t, id, { onlySubjectWorkerId: me.id });
    if (!r || r.results.length === 0) notFound();
    return (
      <div className="space-y-4">
        <Link href="/desempeno" className="text-primary text-sm underline">
          ← Evaluación 360
        </Link>
        <h1 className="text-2xl font-bold">{r.cycle.name}</h1>
        {r.results.map((x) => (
          <ResultsView
            key={x.id}
            name={x.name}
            position={x.position}
            competencies={r.competencies}
            tab={x.tab}
            comments={x.comments}
            anonymous={r.cycle.anonymous}
          />
        ))}
      </div>
    );
  }

  const edit = can(ctx.permissions, "performance", "edit");
  const approve = can(ctx.permissions, "performance", "approve");
  const cycle = (await listCycles(t)).find((c) => c.id === id);
  if (!cycle) notFound();
  const open = cycle.status === "open";
  const [subjects, results, people] = await Promise.all([
    cycleDetail(t, id),
    cycleResults(t, id),
    edit && open ? listWorkers(t, { status: "active" }) : Promise.resolve([]),
  ]);
  const personOpts = people.map((p) => ({ value: p.id, label: p.fullName }));
  const assignFields: FieldSpec[] = [
    { name: "level", label: "Nivel de quien evalúa", type: "select", options: [...LEVELS] },
    {
      name: "evaluatorWorkerId",
      label: "Quién evalúa",
      type: "select",
      options: personOpts,
      empty: "Elige una persona",
    },
  ];

  return (
    <div className="space-y-4">
      <Link href="/desempeno" className="text-primary text-sm underline">
        ← Evaluación 360
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{cycle.name}</h1>
        <span className="flex gap-2">
          <Badge variant={open ? "warning" : "success"}>{open ? "Abierto" : "Cerrado"}</Badge>
          <Badge>{cycle.anonymous ? "Anónimo" : "Identificado"}</Badge>
        </span>
      </div>
      <p className="text-muted-foreground text-sm">
        Límite {formatDate(cycle.dueOn)} · {cycle.done} de {cycle.total} evaluaciones respondidas.
      </p>
      {cycle.anonymous && (
        <Alert variant="warning">
          Ciclo anónimo: aquí ves quién ya respondió (para recordárselo), pero no qué respondió cada
          persona. Los resultados se muestran por nivel y los comentarios sin autor.
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        {edit && open && (
          <FormModal
            title="Agregar persona a evaluar"
            trigger="Agregar persona"
            triggerVariant="default"
          >
            <ActionForm
              action={subjectAction}
              submit="Agregar"
              idPrefix="su-"
              hidden={{ cycleId: id }}
              fields={[
                {
                  name: "workerId",
                  label: "Persona",
                  type: "select",
                  options: personOpts,
                  empty: "Elige una persona",
                },
              ]}
            />
          </FormModal>
        )}
        {approve && open && (
          <RunButton
            action={closeCycleAction}
            arg={id}
            confirm="¿Cerrar el ciclo? Ya no se podrán responder las evaluaciones pendientes y las personas evaluadas verán su resultado."
          >
            Cerrar ciclo
          </RunButton>
        )}
      </div>

      {subjects.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Agrega a las personas que van a ser evaluadas.
        </p>
      )}
      {subjects.map((s) => (
        <Card key={s.id} className="space-y-2">
          <CardTitle>
            {s.name}
            {s.position && (
              <span className="text-muted-foreground text-sm font-normal"> · {s.position}</span>
            )}
          </CardTitle>
          {s.assignments.length === 0 ? (
            <p className="text-muted-foreground text-sm">Sin evaluadores asignados.</p>
          ) : (
            <ul className="divide-y text-sm">
              {s.assignments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {a.evaluator}{" "}
                    <span className="text-muted-foreground">· {levelLabel(a.level)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant={a.submittedAt ? "success" : "warning"}>
                      {a.submittedAt ? "Respondió" : "Pendiente"}
                    </Badge>
                    {edit && open && !a.submittedAt && (
                      <RunButton
                        action={removeAssignmentAction}
                        arg={a.id}
                        confirm="¿Quitar esta asignación?"
                      >
                        Quitar
                      </RunButton>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {edit && open && (
            <FormModal title={`Asignar evaluador a ${s.name}`} trigger="Asignar evaluador">
              <ActionForm
                action={assignmentAction}
                submit="Asignar"
                idPrefix={`as-${s.id}-`}
                hidden={{ subjectId: s.id }}
                fields={assignFields}
              />
            </FormModal>
          )}
        </Card>
      ))}

      {results && results.results.length > 0 && (
        <>
          <h2 className="text-lg font-semibold">Resultados{open && " parciales"}</h2>
          {results.results.map((x) => (
            <ResultsView
              key={x.id}
              name={x.name}
              position={x.position}
              competencies={results.competencies}
              tab={x.tab}
              comments={x.comments}
              anonymous={results.cycle.anonymous}
            />
          ))}
        </>
      )}
    </div>
  );
}
