"use client";
import { useActionState } from "@/components/forms/use-form-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/input";
import { analysisAction, targetAction } from "./actions";

export function TargetForm({
  code,
  target,
  own,
}: {
  code: string;
  target: number | null;
  own: boolean;
}) {
  const [s, action, pending] = useActionState(targetAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="code" value={code} />
      <Field
        idPrefix={`${code}-`}
        state={s}
        saved={own ? target : ""}
        name="target"
        label="Meta de la empresa (vacío = usar la de la plataforma)"
        inputMode="decimal"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Guardar meta
      </Button>
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
    </form>
  );
}

export function AnalysisForm({
  code,
  periodicity,
  from,
  saved,
}: {
  code: string;
  periodicity: string;
  from: string;
  saved: string | null;
}) {
  const [s, action, pending] = useActionState(analysisAction, null);
  const v = typeof s?.values?.analysis === "string" ? s.values.analysis : (saved ?? "");
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="periodicity" value={periodicity} />
      <input type="hidden" name="from" value={from} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <Label htmlFor={`a-${code}`}>Análisis del periodo</Label>
      <textarea
        key={v}
        id={`a-${code}`}
        name="analysis"
        rows={3}
        defaultValue={v}
        className="border-input bg-background w-full rounded-md border p-3 text-base"
      />
      <Button type="submit" size="sm" disabled={pending}>
        Guardar análisis
      </Button>
    </form>
  );
}
