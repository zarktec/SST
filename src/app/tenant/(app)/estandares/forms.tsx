"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useActionState } from "@/components/forms/use-form-state";
import { useTenantPath } from "@/components/layout/base-path";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { FormState } from "@/lib/form-state";
import {
  closeAssessmentAction,
  registerMinistryAction,
  setItemAction,
  startAssessmentAction,
  updateImprovementAction,
} from "./actions";

const sel = "border-input bg-background min-h-11 w-full rounded-md border px-3 text-base";
const STATUS = [
  ["pending", "Pendiente"],
  ["cumple", "Cumple"],
  ["no_cumple", "No cumple"],
  ["no_aplica", "No aplica"],
] as const;

export function StartButton({ year }: { year: number }) {
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const tp = useTenantPath();
  return (
    <div className="space-y-2">
      {msg && !msg.ok && <Alert variant="destructive">{msg.message}</Alert>}
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await startAssessmentAction(year);
            setMsg(r);
            if (r.ok && r.id) router.push(tp(`/estandares/${r.id}`));
          })
        }
      >
        {pending ? "Iniciando…" : `Iniciar autoevaluación ${year}`}
      </Button>
    </div>
  );
}

type Item = {
  itemCode: string;
  status: string;
  justification: string | null;
  responsibleName: string | null;
  observations: string | null;
  evidence: string | null;
  snapshot: { criterion: string; verification: string };
};

export function ItemForm({
  assessmentId,
  item,
  readOnly,
}: {
  assessmentId: string;
  item: Item;
  readOnly: boolean;
}) {
  const [s, action, pending] = useActionState(setItemAction, null);
  const pfx = `${item.itemCode}-`;
  const v = (k: string, saved: string | null) =>
    typeof s?.values?.[k] === "string" ? String(s.values[k]) : (saved ?? "");
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="assessmentId" value={assessmentId} />
      <input type="hidden" name="itemCode" value={item.itemCode} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <p className="text-sm">
        <span className="font-semibold">{item.itemCode}</span> · {item.snapshot.criterion}
        {item.snapshot.verification && (
          <span className="text-muted-foreground block">
            Verificación: {item.snapshot.verification}
          </span>
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${pfx}status`}>Calificación</Label>
          <Select
            id={`${pfx}status`}
            name="status"
            className={sel}
            defaultValue={v("status", item.status)}
            disabled={readOnly}
          >
            {STATUS.map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <Field
          idPrefix={pfx}
          state={s}
          saved={item.responsibleName}
          name="responsibleName"
          label="Responsable"
          disabled={readOnly}
        />
        <Field
          idPrefix={pfx}
          state={s}
          saved={item.evidence}
          name="evidence"
          label="Evidencia (descripción o enlace)"
          disabled={readOnly}
        />
        <Field
          idPrefix={pfx}
          state={s}
          saved={item.justification}
          name="justification"
          label="Justificación (si no aplica)"
          disabled={readOnly}
        />
        <Field
          idPrefix={pfx}
          state={s}
          saved={item.observations}
          name="observations"
          label="Observaciones"
          disabled={readOnly}
        />
      </div>
      {!readOnly && (
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Guardar ítem"}
        </Button>
      )}
    </form>
  );
}

export function CloseButton({ id }: { id: string }) {
  const [msg, setMsg] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="space-y-2">
      {msg && <Alert variant={msg.ok ? "success" : "destructive"}>{msg.message}</Alert>}
      <Button
        disabled={pending}
        onClick={() =>
          confirm(
            "Al cerrar, la autoevaluación queda como registro histórico y no se podrá modificar. ¿Cerrar?",
          ) &&
          start(async () => {
            const r = await closeAssessmentAction(id);
            setMsg(r);
            if (r?.ok) router.refresh();
          })
        }
      >
        {pending ? "Cerrando…" : "Cerrar autoevaluación"}
      </Button>
    </div>
  );
}

export function MinistryForm({ id }: { id: string }) {
  const [s, action, pending] = useActionState(registerMinistryAction, null);
  return (
    <form action={action} className="space-y-3">
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <input type="hidden" name="id" value={id} />
      <Field
        state={s}
        name="date"
        label="Fecha de registro en la plataforma del Ministerio"
        type="date"
        required
      />
      <Button type="submit" variant="outline" disabled={pending}>
        Guardar registro
      </Button>
    </form>
  );
}

export function ImprovementForm({
  it,
}: {
  it: {
    id: string;
    itemCode: string;
    description: string;
    responsibleName: string | null;
    dueDate: string | null;
    status: string;
    closureNote: string | null;
  };
}) {
  const [s, action, pending] = useActionState(updateImprovementAction, null);
  const pfx = `${it.itemCode}-`;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={it.id} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <p className="text-sm">
        <span className="font-semibold">{it.itemCode}</span> · {it.description}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          idPrefix={pfx}
          state={s}
          saved={it.responsibleName}
          name="responsibleName"
          label="Responsable"
        />
        <Field
          idPrefix={pfx}
          state={s}
          saved={it.dueDate}
          name="dueDate"
          label="Fecha límite"
          type="date"
        />
        <div className="space-y-1">
          <Label htmlFor={`${pfx}status`}>Estado</Label>
          <Select
            id={`${pfx}status`}
            name="status"
            className={sel}
            defaultValue={typeof s?.values?.status === "string" ? s.values.status : it.status}
          >
            <option value="open">Abierta</option>
            <option value="in_progress">En curso</option>
            <option value="done">Cerrada</option>
          </Select>
        </div>
        <Field
          idPrefix={pfx}
          state={s}
          saved={it.closureNote}
          name="closureNote"
          label="Cómo se cerró (obligatorio al cerrar)"
        />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Guardar acción
      </Button>
    </form>
  );
}
