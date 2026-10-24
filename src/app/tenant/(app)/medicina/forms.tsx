"use client";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CAUSES, CONCEPTS } from "@/modules/medical/rules";
import {
  absenceAction,
  adaptationAction,
  closeAbsenceAction,
  resultAction,
  scheduleAction,
  sendIpsAction,
} from "./actions";
import { todayYmd } from "@/lib/dates";

const sel = "border-input bg-background min-h-11 w-full rounded-md border px-3 text-base";
const today = () => todayYmd();
type Opt = { id: string; name: string };

export function ScheduleForm({
  people,
  types,
}: {
  people: Opt[];
  types: { code: string; name: string }[];
}) {
  const [s, action, pending] = useActionState(scheduleAction, null);
  return (
    <form action={action} className="space-y-3">
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="workerId">Persona</Label>
          <Select
            id="workerId"
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
        <div className="space-y-1">
          <Label htmlFor="type">Tipo de evaluación</Label>
          <Select
            id="type"
            name="type"
            className={sel}
            defaultValue={
              typeof s?.values?.type === "string" ? s.values.type : (types[0]?.code ?? "")
            }
          >
            {types.map((t) => (
              <option key={t.code} value={t.code}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>
        <Field
          state={s}
          saved={today()}
          name="scheduledDate"
          label="Fecha programada"
          type="date"
          required
        />
        <Field state={s} name="ipsName" label="IPS" />
        <Field state={s} name="requestNote" label="Observaciones de la solicitud" />
      </div>
      <p className="text-muted-foreground text-xs">
        No se permite solicitar pruebas de embarazo, VIH ni serología como requisito. Los costos los
        asume el empleador.
      </p>
      <Button type="submit" disabled={pending || people.length === 0}>
        Programar evaluación
      </Button>
    </form>
  );
}

export function ResultForm({ evaluationId }: { evaluationId: string }) {
  const [s, action, pending] = useActionState(resultAction, null);
  const pfx = `${evaluationId}-`;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="evaluationId" value={evaluationId} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          idPrefix={pfx}
          state={s}
          saved={today()}
          name="performedDate"
          label="Fecha de realización"
          type="date"
          required
        />
        <div className="space-y-1">
          <Label htmlFor={`${pfx}concept`}>Concepto de aptitud</Label>
          <Select
            id={`${pfx}concept`}
            name="concept"
            className={sel}
            defaultValue={typeof s?.values?.concept === "string" ? s.values.concept : "apto"}
          >
            {CONCEPTS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <Field
          idPrefix={pfx}
          state={s}
          name="restrictions"
          label="Restricciones (sin historia clínica)"
        />
        <Field idPrefix={pfx} state={s} name="recommendations" label="Recomendaciones" />
        <Field idPrefix={pfx} state={s} name="ipsName" label="IPS" />
        <Field
          idPrefix={pfx}
          state={s}
          name="costPesos"
          label="Costo asumido por el empleador (COP)"
          inputMode="numeric"
        />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        Registrar resultado
      </Button>
    </form>
  );
}

export function AdaptationForm({ id }: { id: string }) {
  const [s, action, pending] = useActionState(adaptationAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <Field idPrefix={`${id}-`} state={s} name="note" label="Adaptación realizada" />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Cerrar tarea
      </Button>
    </form>
  );
}

export function IpsForm({ id }: { id: string }) {
  const [s, action, pending] = useActionState(sendIpsAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <Field idPrefix={`${id}-ips-`} state={s} name="email" label="Correo de la IPS" type="email" />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Enviar perfil del cargo y peligros
      </Button>
    </form>
  );
}

export function AbsenceForm({ people }: { people: Opt[] }) {
  const [s, action, pending] = useActionState(absenceAction, null);
  return (
    <form action={action} className="space-y-3">
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="a-worker">Persona</Label>
          <Select
            id="a-worker"
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
        <div className="space-y-1">
          <Label htmlFor="a-cause">Causa</Label>
          <Select
            id="a-cause"
            name="cause"
            className={sel}
            defaultValue={typeof s?.values?.cause === "string" ? s.values.cause : "common_illness"}
          >
            {CAUSES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        <Field
          idPrefix="a-"
          state={s}
          saved={today()}
          name="startDate"
          label="Inicio"
          type="date"
          required
        />
        <Field
          idPrefix="a-"
          state={s}
          name="endDate"
          label="Fin (vacío si sigue en curso)"
          type="date"
        />
        <Field
          idPrefix="a-"
          state={s}
          name="costPesos"
          label="Costo estimado (COP)"
          inputMode="numeric"
        />
        <Field idPrefix="a-" state={s} name="note" label="Observación" />
      </div>
      <Button type="submit" disabled={pending || people.length === 0}>
        Registrar ausencia
      </Button>
    </form>
  );
}

export function CloseAbsenceForm({ id }: { id: string }) {
  const [s, action, pending] = useActionState(closeAbsenceAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <Field
        idPrefix={`${id}-`}
        state={s}
        saved={today()}
        name="endDate"
        label="Fecha de regreso"
        type="date"
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Cerrar ausencia
      </Button>
    </form>
  );
}
