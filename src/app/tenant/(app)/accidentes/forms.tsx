"use client";
import { useActionState, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { FormState } from "@/lib/form-state";
import { SEVERITY } from "@/modules/incidents/rules";
import {
  addActionAction,
  completeAction,
  diseaseAction,
  lessonsAction,
  markReportedAction,
  qualifyAction,
  remitAction,
  reportAction,
  saveInvestigationAction,
  startAction,
} from "./actions";
import { todayYmd } from "@/lib/dates";

const sel = "border-input bg-background min-h-11 w-full rounded-md border px-3 text-base";
const today = () => todayYmd();
type Opt = { id: string; name: string };
const Area = ({
  id,
  label,
  name,
  rows = 3,
  saved,
  state,
}: {
  id: string;
  label: string;
  name: string;
  rows?: number;
  saved?: string | null;
  state: FormState;
}) => {
  const v = typeof state?.values?.[name] === "string" ? String(state.values[name]) : (saved ?? "");
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        key={v}
        id={id}
        name={name}
        rows={rows}
        defaultValue={v}
        className="border-input bg-background w-full rounded-md border p-3 text-base"
      />
    </div>
  );
};

export function ActionButton({
  run,
  children,
  confirm: ask,
  variant = "outline",
}: {
  run: () => Promise<FormState>;
  children: React.ReactNode;
  confirm?: string;
  variant?: "default" | "outline";
}) {
  const [msg, setMsg] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      {msg && <Alert variant={msg.ok ? "success" : "destructive"}>{msg.message}</Alert>}
      <Button
        variant={variant}
        size="sm"
        disabled={pending}
        onClick={() => (!ask || window.confirm(ask)) && start(async () => setMsg(await run()))}
      >
        {pending ? "Procesando…" : children}
      </Button>
    </div>
  );
}
export const StartButton = ({ id }: { id: string }) => (
  <ActionButton variant="default" run={() => startAction(id)}>
    Abrir investigación
  </ActionButton>
);
export const CompleteButton = ({ id }: { id: string }) => (
  <ActionButton
    variant="default"
    run={() => completeAction(id)}
    confirm="Se cerrará la investigación del evento. ¿Continuar?"
  >
    Cerrar investigación
  </ActionButton>
);

export function ReportForm({
  people,
  defaultName,
  centers,
}: {
  people: Opt[];
  defaultName: string;
  centers: Opt[];
}) {
  const [s, action, pending] = useActionState(reportAction, null);
  return (
    <form action={action} className="space-y-3">
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="kind">Tipo de evento</Label>
          <Select
            id="kind"
            name="kind"
            className={sel}
            defaultValue={typeof s?.values?.kind === "string" ? s.values.kind : "accident"}
          >
            <option value="accident">Accidente de trabajo (con lesión)</option>
            <option value="incident">Incidente (sin lesión)</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="severity">Gravedad</Label>
          <Select
            id="severity"
            name="severity"
            className={sel}
            defaultValue={typeof s?.values?.severity === "string" ? s.values.severity : "minor"}
          >
            {SEVERITY.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </Select>
          {s?.fieldErrors?.severity && (
            <p className="text-destructive text-sm" role="alert">
              {s.fieldErrors.severity}
            </p>
          )}
        </div>
        {people.length > 0 ? (
          <div className="space-y-1">
            <Label htmlFor="workerId">Persona afectada</Label>
            <Select
              id="workerId"
              name="workerId"
              className={sel}
              defaultValue={typeof s?.values?.workerId === "string" ? s.values.workerId : ""}
            >
              <option value="">Otra persona (escribir nombre)</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <Field
          state={s}
          saved={people.length ? "" : defaultName}
          name="affectedName"
          label="Nombre de la persona afectada (si no está en la lista)"
        />
        <Field
          state={s}
          saved={today()}
          name="occurredDate"
          label="Fecha del evento"
          type="date"
          required
        />
        <Field state={s} saved="08:00" name="occurredTime" label="Hora" type="time" required />
        <Field state={s} name="place" label="Lugar" required />
        {centers.length > 1 && (
          <div className="space-y-1">
            <Label htmlFor="workCenterId">Sede</Label>
            <Select id="workCenterId" name="workCenterId" className={sel} defaultValue="">
              <option value="">—</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <Field state={s} name="activity" label="Actividad que realizaba" />
        <Field state={s} name="bodyPart" label="Parte del cuerpo afectada" />
        <Field state={s} name="injuryType" label="Tipo de lesión" />
        <Field state={s} name="witnesses" label="Testigos" />
      </div>
      <Area id="description" name="description" label="¿Qué pasó?" state={s} rows={4} />
      {s?.fieldErrors?.description && (
        <p className="text-destructive text-sm" role="alert">
          {s.fieldErrors.description}
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        Las fotos del evento se podrán adjuntar cuando se habilite el almacenamiento de archivos.
      </p>
      <Button type="submit" disabled={pending}>
        Reportar evento
      </Button>
    </form>
  );
}

export function ReportedForm({ id }: { id: string }) {
  const [s, action, pending] = useActionState(markReportedAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          idPrefix="r-"
          state={s}
          saved={today()}
          name="arlReportedAt"
          label="Reportado a la ARL el"
          type="date"
          required
        />
        <Field
          idPrefix="r-"
          state={s}
          name="epsReportedAt"
          label="Reportado a la EPS el (vacío = misma fecha)"
          type="date"
        />
        <Field idPrefix="r-" state={s} name="reportNumber" label="Número de reporte ARL" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        Registrar reporte
      </Button>
    </form>
  );
}

type Inv = {
  team: { name: string; role: string }[];
  method: string;
  analysis: unknown;
  immediateCauses: string | null;
  basicCauses: string | null;
  conclusions: string | null;
};
export function InvestigationForm({ id, inv, severe }: { id: string; inv: Inv; severe: boolean }) {
  const [s, action, pending] = useActionState(saveInvestigationAction, null);
  const name = (r: string) => inv.team.find((m) => m.role === r)?.name ?? "";
  const lines = Array.isArray(inv.analysis)
    ? (inv.analysis as unknown[])
        .map((x) => (typeof x === "string" ? x : String((x as { text?: string }).text ?? "")))
        .join("\n")
    : "";
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold">Equipo investigador</legend>
        <Field
          idPrefix="t-"
          state={s}
          saved={name("boss")}
          name="boss"
          label="Jefe inmediato o supervisor"
        />
        <Field
          idPrefix="t-"
          state={s}
          saved={name("copasst")}
          name="copasst"
          label="Representante del COPASST / Vigía"
        />
        <Field
          idPrefix="t-"
          state={s}
          saved={name("sst")}
          name="sst"
          label="Responsable del SG-SST"
        />
        <Field
          idPrefix="t-"
          state={s}
          saved={name("licensed")}
          name="licensed"
          label={
            severe
              ? "Profesional con licencia en SST (obligatorio)"
              : "Profesional con licencia en SST"
          }
        />
      </fieldset>
      <div className="space-y-1">
        <Label htmlFor="method">Metodología</Label>
        <Select
          id="method"
          name="method"
          className={sel}
          defaultValue={typeof s?.values?.method === "string" ? s.values.method : inv.method}
        >
          <option value="five_whys">5 porqués</option>
          <option value="cause_tree">Árbol de causas</option>
        </Select>
      </div>
      <Area
        id="analysis"
        name="analysis"
        label="Análisis (una causa por línea, de la más cercana al evento a la raíz; mínimo 3)"
        state={s}
        saved={lines}
        rows={5}
      />
      <Area
        id="immediateCauses"
        name="immediateCauses"
        label="Causas inmediatas (actos y condiciones)"
        state={s}
        saved={inv.immediateCauses}
      />
      <Area
        id="basicCauses"
        name="basicCauses"
        label="Causas básicas (factores personales y del trabajo)"
        state={s}
        saved={inv.basicCauses}
      />
      <Area
        id="conclusions"
        name="conclusions"
        label="Conclusiones"
        state={s}
        saved={inv.conclusions}
      />
      <Button type="submit" disabled={pending}>
        Guardar investigación
      </Button>
    </form>
  );
}

export function PlanActionForm({ id }: { id: string }) {
  const [s, action, pending] = useActionState(addActionAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field idPrefix="pa-" state={s} name="title" label="Acción" required />
        <div className="space-y-1">
          <Label htmlFor="pa-type">Tipo</Label>
          <Select id="pa-type" name="type" className={sel} defaultValue="corrective">
            <option value="corrective">Correctiva</option>
            <option value="preventive">Preventiva</option>
          </Select>
        </div>
        <Field idPrefix="pa-" state={s} name="responsibleName" label="Responsable" required />
        <Field idPrefix="pa-" state={s} name="dueDate" label="Fecha límite" type="date" required />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Agregar al plan de acción
      </Button>
    </form>
  );
}

export function RemitForm({ id }: { id: string }) {
  const [s, action, pending] = useActionState(remitAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <Field
        idPrefix="rm-"
        state={s}
        saved={today()}
        name="date"
        label="Remitida a la ARL el"
        type="date"
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Registrar remisión
      </Button>
    </form>
  );
}

export function LessonsForm({ id, saved }: { id: string; saved: string | null }) {
  const [s, action, pending] = useActionState(lessonsAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <Area
        id="lessons"
        name="lessons"
        label="Lecciones aprendidas para divulgar"
        state={s}
        saved={saved}
        rows={4}
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Registrar divulgación
      </Button>
    </form>
  );
}

export function DiseaseForm({ people }: { people: Opt[] }) {
  const [s, action, pending] = useActionState(diseaseAction, null);
  return (
    <form action={action} className="space-y-3">
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="d-worker">Persona</Label>
          <Select
            id="d-worker"
            name="workerId"
            className={sel}
            defaultValue={
              typeof s?.values?.workerId === "string" ? s.values.workerId : (people[0]?.id ?? "")
            }
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <Field idPrefix="d-" state={s} name="diagnosis" label="Diagnóstico" required />
        <Field
          idPrefix="d-"
          state={s}
          saved={today()}
          name="detectedOn"
          label="Fecha de detección"
          type="date"
          required
        />
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="isNew" defaultChecked className="size-5" /> Caso nuevo en el
        periodo
      </label>
      <Button type="submit" disabled={pending || people.length === 0}>
        Registrar caso
      </Button>
    </form>
  );
}

export function QualifyForm({ id }: { id: string }) {
  const [s, action, pending] = useActionState(qualifyAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`q-${id}`}>Calificación</Label>
          <Select id={`q-${id}`} name="qualification" className={sel} defaultValue="occupational">
            <option value="occupational">Origen laboral</option>
            <option value="common">Origen común</option>
          </Select>
        </div>
        <Field
          idPrefix={`${id}-`}
          state={s}
          saved={today()}
          name="qualifiedOn"
          label="Fecha de calificación"
          type="date"
        />
        <Field
          idPrefix={`${id}-`}
          state={s}
          name="qualifiedBy"
          label="Calificó (EPS, ARL, junta)"
        />
        <Field idPrefix={`${id}-`} state={s} name="followUp" label="Seguimiento" />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Registrar calificación
      </Button>
    </form>
  );
}
