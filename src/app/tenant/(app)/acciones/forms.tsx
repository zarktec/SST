"use client";
import { useActionState } from "@/components/forms/use-form-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { TYPES } from "@/modules/capa/rules";
import { createActionAction, moveActionAction, updateActionAction, verifyAction } from "./actions";

const sel = "border-input bg-background min-h-11 w-full rounded-md border px-3 text-base";

export function CreateForm() {
  const [s, action, pending] = useActionState(createActionAction, null);
  return (
    <form action={action} className="space-y-3">
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field state={s} name="title" label="Acción" required />
        <div className="space-y-1">
          <Label htmlFor="type">Tipo</Label>
          <Select
            id="type"
            name="type"
            className={sel}
            defaultValue={typeof s?.values?.type === "string" ? s.values.type : "corrective"}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <Field state={s} name="responsibleName" label="Responsable" required />
        <Field state={s} name="dueDate" label="Fecha límite" type="date" required />
        <Field state={s} name="rootCause" label="Análisis de causa" />
        <Field state={s} name="description" label="Descripción" />
      </div>
      <Button type="submit" disabled={pending}>
        Crear acción
      </Button>
    </form>
  );
}

export function EditForm({
  a,
}: {
  a: { id: string; rootCause: string | null; responsibleName: string | null; dueDate: string };
}) {
  const [s, action, pending] = useActionState(updateActionAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={a.id} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          idPrefix="e-"
          state={s}
          saved={a.responsibleName}
          name="responsibleName"
          label="Responsable"
        />
        <Field
          idPrefix="e-"
          state={s}
          saved={a.dueDate}
          name="dueDate"
          label="Fecha límite"
          type="date"
        />
        <Field
          idPrefix="e-"
          state={s}
          saved={a.rootCause}
          name="rootCause"
          label="Análisis de causa"
        />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Guardar cambios
      </Button>
    </form>
  );
}

export function MoveForm({
  id,
  options,
}: {
  id: string;
  options: { value: string; label: string }[];
}) {
  const [s, action, pending] = useActionState(moveActionAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="space-y-1">
        <Label htmlFor="to">Pasar a</Label>
        <Select
          id="to"
          name="to"
          className={sel}
          defaultValue={typeof s?.values?.to === "string" ? s.values.to : options[0]?.value}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      <Field state={s} name="note" label="Evidencia del cierre o motivo de la cancelación" />
      <Button type="submit" size="sm" disabled={pending}>
        Actualizar estado
      </Button>
    </form>
  );
}

export function VerifyForm({ id }: { id: string }) {
  const [s, action, pending] = useActionState(verifyAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="space-y-1">
        <Label htmlFor="effective">¿La acción fue eficaz?</Label>
        <Select id="effective" name="effective" className={sel} defaultValue="yes">
          <option value="yes">Sí, eficaz</option>
          <option value="no">No fue eficaz</option>
        </Select>
      </div>
      <Field state={s} name="note" label="Cómo se verificó" required />
      <Button type="submit" size="sm" disabled={pending}>
        Registrar verificación
      </Button>
    </form>
  );
}
