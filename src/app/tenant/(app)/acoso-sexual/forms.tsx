"use client";
import { useActionState } from "@/components/forms/use-form-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { submitHarassmentAction, updateHarassmentAction } from "./actions";

export function HarassmentForm() {
  const [s, act, pending] = useActionState(submitHarassmentAction, null);
  if (s?.ok) return <Alert variant="success">{s.message}</Alert>;
  const v = typeof s?.values?.narrative === "string" ? s.values.narrative : "";
  return (
    <form action={act} className="space-y-3">
      {s && <Alert variant="destructive">{s.message}</Alert>}
      <div className="space-y-1">
        <Label htmlFor="narrative">Describe lo ocurrido</Label>
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
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="anonymous" className="size-5" /> Reportar de forma anónima
      </label>
      <Button type="submit" disabled={pending}>
        Enviar reporte
      </Button>
    </form>
  );
}

export function UpdateForm({ id }: { id: string }) {
  const [s, action, pending] = useActionState(updateHarassmentAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="space-y-1">
        <Label htmlFor="status">Estado</Label>
        <Select
          id="status"
          name="status"
          className="border-input bg-background min-h-11 w-full rounded-md border px-3 text-base"
          defaultValue="in_review"
        >
          <option value="in_review">En revisión</option>
          <option value="referred">Remitido a la autoridad competente</option>
          <option value="closed">Cerrado</option>
        </Select>
      </div>
      <Field state={s} name="note" label="Nota (queda cifrada)" required />
      <Button type="submit" disabled={pending}>
        Registrar
      </Button>
    </form>
  );
}
