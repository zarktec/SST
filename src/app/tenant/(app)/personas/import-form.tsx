"use client";
import { useActionState } from "@/components/forms/use-form-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { importWorkersAction } from "./actions";

export function ImportForm() {
  const [s, action, pending] = useActionState(importWorkersAction, null);
  return (
    <form action={action} className="space-y-3">
      {s && (
        <Alert variant={s.ok ? "success" : "destructive"}>
          <p>{s.message}</p>
          {s.details && s.details.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {s.details.slice(0, 50).map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </Alert>
      )}
      <div className="space-y-1">
        <Label htmlFor="file">Archivo CSV (Excel: Guardar como → CSV)</Label>
        <Input id="file" name="file" type="file" accept=".csv,text/csv" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Importando…" : "Importar"}
      </Button>
    </form>
  );
}
