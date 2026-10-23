"use client";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { saveEntryAction } from "./actions";

const sel = "border-input bg-background min-h-11 w-full rounded-md border px-3 text-base";
type E = {
  applies: string;
  justification: string | null;
  compliance: string;
  evidence: string | null;
  responsibleName: string | null;
  nextReviewDate: string | null;
  notes: string | null;
};

export function EntryForm({ kind, code, entry }: { kind: string; code: string; entry: E | null }) {
  const [s, action, pending] = useActionState(saveEntryAction, null);
  const pfx = `${kind}-${code}-`;
  const v = (k: string, d: string) =>
    typeof s?.values?.[k] === "string" ? String(s.values[k]) : d;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="code" value={code} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`${pfx}applies`}>¿Aplica a la empresa?</Label>
          <Select
            id={`${pfx}applies`}
            name="applies"
            className={sel}
            defaultValue={v("applies", entry?.applies ?? "yes")}
          >
            <option value="yes">Sí aplica</option>
            <option value="no">No aplica</option>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${pfx}compliance`}>Cumplimiento</Label>
          <Select
            id={`${pfx}compliance`}
            name="compliance"
            className={sel}
            defaultValue={v("compliance", entry?.compliance ?? "pending")}
          >
            <option value="pending">Pendiente</option>
            <option value="cumple">Cumple</option>
            <option value="parcial">Cumple parcialmente</option>
            <option value="no_cumple">No cumple</option>
          </Select>
        </div>
        <Field
          idPrefix={pfx}
          state={s}
          saved={entry?.justification}
          name="justification"
          label="Justificación (si no aplica)"
        />
        <Field
          idPrefix={pfx}
          state={s}
          saved={entry?.evidence}
          name="evidence"
          label="Evidencia de cumplimiento"
        />
        <Field
          idPrefix={pfx}
          state={s}
          saved={entry?.responsibleName}
          name="responsibleName"
          label="Responsable"
        />
        <Field
          idPrefix={pfx}
          state={s}
          saved={entry?.nextReviewDate}
          name="nextReviewDate"
          label="Próxima revisión"
          type="date"
        />
        <Field idPrefix={pfx} state={s} saved={entry?.notes} name="notes" label="Notas" />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}
