"use client";
import { useState, useTransition } from "react";
import { useActionState } from "@/components/forms/use-form-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { FormState } from "@/lib/form-state";
import {
  createPlanAction,
  reopenAction,
  saveActivityAction,
  setStatusAction,
  signAction,
  suggestAction,
} from "./actions";

const sel = "border-input bg-background min-h-11 w-full rounded-md border px-3 text-base";

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
export const CreatePlan = ({ year }: { year: number }) => (
  <ActionButton
    variant="default"
    run={() => createPlanAction(year)}
  >{`Crear plan ${year}`}</ActionButton>
);
export const Suggest = ({ planId }: { planId: string }) => (
  <ActionButton run={() => suggestAction(planId)}>
    Sugerir actividades (mejoramiento y peligros)
  </ActionButton>
);
export const Sign = ({
  planId,
  as,
  label,
}: {
  planId: string;
  as: "employer" | "responsible";
  label: string;
}) => (
  <ActionButton
    variant="default"
    run={() => signAction(planId, as)}
    confirm="Tu firma queda registrada con fecha, hora y la huella del contenido del plan. ¿Firmar?"
  >
    {label}
  </ActionButton>
);
export const Reopen = ({ planId }: { planId: string }) => (
  <ActionButton
    run={() => reopenAction(planId)}
    confirm="Se borrarán las firmas y ambos deberán firmar de nuevo. ¿Reabrir?"
  >
    Reabrir plan
  </ActionButton>
);

type A = {
  id: string;
  phva: string;
  title: string;
  objective: string | null;
  responsibleName: string | null;
  startDate: string;
  endDate: string;
  resources: string | null;
  budgetCents: bigint | null;
  status: string;
  evidence: string | null;
};

export function ActivityForm({ planId, activity }: { planId: string; activity?: A }) {
  const [s, action, pending] = useActionState(saveActivityAction, null);
  const pfx = activity ? `${activity.id}-` : "new-";
  const f = (
    name: keyof A | "budgetPesos",
    label: string,
    extra: object = {},
    saved?: string | number | null,
  ) => (
    <Field
      idPrefix={pfx}
      state={s}
      saved={saved ?? (activity ? (activity[name as keyof A] as string | null) : undefined)}
      name={name}
      label={label}
      {...extra}
    />
  );
  const phva = typeof s?.values?.phva === "string" ? s.values.phva : (activity?.phva ?? "P");
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="planId" value={planId} />
      {activity && <input type="hidden" name="activityId" value={activity.id} />}
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        {f("title", "Actividad", { required: true })}
        <div className="space-y-1">
          <Label htmlFor={`${pfx}phva`}>Ciclo PHVA</Label>
          <Select id={`${pfx}phva`} name="phva" className={sel} defaultValue={phva}>
            <option value="P">Planear</option>
            <option value="H">Hacer</option>
            <option value="V">Verificar</option>
            <option value="A">Actuar</option>
          </Select>
        </div>
        {f("objective", "Objetivo")}
        {f("responsibleName", "Responsable")}
        {f("startDate", "Inicio", { type: "date", required: true })}
        {f("endDate", "Fin", { type: "date", required: true })}
        {f("resources", "Recursos")}
        {f(
          "budgetPesos",
          "Presupuesto (COP)",
          { inputMode: "numeric" },
          activity?.budgetCents != null ? String(activity.budgetCents / 100n) : undefined,
        )}
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Guardando…" : activity ? "Actualizar" : "Agregar actividad"}
      </Button>
    </form>
  );
}

export function StatusForm({ activity }: { activity: A }) {
  const [s, action, pending] = useActionState(setStatusAction, null);
  const pfx = `${activity.id}-st-`;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="activityId" value={activity.id} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${pfx}status`}>Estado</Label>
          <Select
            id={`${pfx}status`}
            name="status"
            className={sel}
            defaultValue={typeof s?.values?.status === "string" ? s.values.status : activity.status}
          >
            <option value="pending">Pendiente</option>
            <option value="in_progress">En curso</option>
            <option value="done">Realizada</option>
            <option value="cancelled">Cancelada</option>
          </Select>
        </div>
        <Field
          idPrefix={pfx}
          state={s}
          saved={activity.evidence}
          name="evidence"
          label="Evidencia (obligatoria al realizar)"
        />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Guardar estado
      </Button>
    </form>
  );
}
