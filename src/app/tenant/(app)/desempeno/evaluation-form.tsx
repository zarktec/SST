"use client";
import { useActionState } from "@/components/forms/use-form-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { FormState } from "@/lib/form-state";
import type { Competency } from "@/modules/performance/rules";

/** Formulario F-RH-45: una competencia por bloque, con la descripción de cada calificación de 5 a 1. */
export function EvaluationForm({
  action,
  assignmentId,
  competencies,
}: {
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  assignmentId: string;
  competencies: Competency[];
}) {
  const [s, formAction, pending] = useActionState(action, null);
  const chosen = (k: string) => {
    const v = s?.values?.[`r_${k}`];
    return typeof v === "string" ? v : "";
  };
  if (s?.ok) return <Alert variant="success">{s.message}</Alert>;
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      {s && !s.ok && <Alert variant="destructive">{s.message}</Alert>}
      {competencies.map((c) => (
        <Card key={c.key}>
          <fieldset className="space-y-2">
            <legend className="text-base font-semibold">{c.name}</legend>
            {(["5", "4", "3", "2", "1"] as const).map((n) => (
              <label
                key={n}
                className="hover:bg-muted flex min-h-11 cursor-pointer items-start gap-3 rounded-md p-2 text-sm"
              >
                <input
                  type="radio"
                  name={`r_${c.key}`}
                  value={n}
                  defaultChecked={chosen(c.key) === n}
                  className="mt-1 size-5 shrink-0"
                  required
                />
                <span>
                  <strong>{n}</strong> — {c.levels[n]}
                </span>
              </label>
            ))}
          </fieldset>
        </Card>
      ))}
      <div className="space-y-1">
        <label htmlFor="comment" className="text-sm font-medium">
          Comentario (opcional)
        </label>
        <textarea
          id="comment"
          name="comment"
          rows={3}
          maxLength={1500}
          defaultValue={typeof s?.values?.comment === "string" ? s.values.comment : ""}
          className="border-input bg-background w-full rounded-md border p-3 text-base"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Enviando…" : "Enviar evaluación"}
      </Button>
    </form>
  );
}
