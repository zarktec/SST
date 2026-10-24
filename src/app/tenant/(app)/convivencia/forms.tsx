"use client";
import { useState, useTransition } from "react";
import { useActionState } from "@/components/forms/use-form-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SignaturePad } from "@/components/ui/signature-pad";
import type { FormState } from "@/lib/form-state";
import { STAGE_LABEL, type Stage } from "@/modules/convivencia/rules";
import { advanceAction, signConfidentialityAction, submitComplaintAction } from "./actions";

const sel = "border-input bg-background min-h-11 w-full rounded-md border px-3 text-base";

export function ComplaintForm({
  people,
  centers,
  action,
}: {
  people: { id: string; name: string }[];
  centers: { id: string; name: string }[];
  action?: typeof submitComplaintAction;
}) {
  const [s, act, pending] = useActionState(action ?? submitComplaintAction, null);
  if (s?.ok) return <Alert variant="success">{s.message}</Alert>;
  const v = typeof s?.values?.narrative === "string" ? s.values.narrative : "";
  return (
    <form action={act} className="space-y-3">
      {s && <Alert variant="destructive">{s.message}</Alert>}
      <div className="space-y-1">
        <Label htmlFor="narrative">Describe los hechos (qué, cuándo, dónde, quién)</Label>
        <textarea
          key={v}
          id="narrative"
          name="narrative"
          rows={6}
          defaultValue={v}
          className="border-input bg-background w-full rounded-md border p-3 text-base"
        />
        {s?.fieldErrors?.narrative && (
          <p className="text-destructive text-sm" role="alert">
            {s.fieldErrors.narrative}
          </p>
        )}
      </div>
      {people.length > 0 && (
        <div className="space-y-1">
          <Label htmlFor="respondentWorkerId">Persona a la que se refiere (opcional)</Label>
          <Select id="respondentWorkerId" name="respondentWorkerId" className={sel} defaultValue="">
            <option value="">No la identifico</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      )}
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
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="anonymous" className="size-5" /> Presentarla de forma anónima
        (no se guardará quién la radica)
      </label>
      <p className="text-muted-foreground text-xs">
        Tu queja se guarda cifrada y solo la ven los miembros del comité obligados a la
        confidencialidad.
      </p>
      <Button type="submit" disabled={pending}>
        Radicar queja
      </Button>
    </form>
  );
}

export function ConfidentialityForm() {
  const [sig, setSig] = useState<string | null>(null);
  const [msg, setMsg] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      {msg && <Alert variant={msg.ok ? "success" : "destructive"}>{msg.message}</Alert>}
      <p className="text-sm">
        Me comprometo a guardar reserva sobre las quejas, las partes y todo lo tratado en el comité,
        y a no usar esa información para fines distintos al trámite.
      </p>
      <SignaturePad onChange={setSig} />
      <Button
        disabled={!sig || pending}
        onClick={() => start(async () => setMsg(await signConfidentialityAction(sig!)))}
      >
        Firmar acuerdo de confidencialidad
      </Button>
    </div>
  );
}

export function AdvanceForm({ id, next }: { id: string; next: Stage[] }) {
  const [s, action, pending] = useActionState(advanceAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="space-y-1">
        <Label htmlFor="stage">Siguiente paso</Label>
        <Select
          id="stage"
          name="stage"
          className={sel}
          defaultValue={typeof s?.values?.stage === "string" ? s.values.stage : next[0]}
        >
          {next.map((st) => (
            <option key={st} value={st}>
              {STAGE_LABEL[st]}
            </option>
          ))}
        </Select>
      </div>
      <Field state={s} name="note" label="Nota del paso (queda cifrada)" required />
      <Button type="submit" disabled={pending}>
        Registrar paso
      </Button>
    </form>
  );
}
