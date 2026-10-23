"use client";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { tenantOperationAction, type TenantFormState } from "../actions";

function Op({
  tenantId,
  op,
  label,
  variant = "outline",
  fields,
}: {
  tenantId: string;
  op: Parameters<typeof tenantOperationAction>[1];
  label: string;
  variant?: "outline" | "destructive" | "secondary";
  fields?: { name: string; label: string; type?: string; placeholder?: string }[];
}) {
  const [state, action, pending] = useActionState<TenantFormState, FormData>(
    tenantOperationAction.bind(null, tenantId, op),
    null,
  );
  return (
    <form action={action} className="space-y-2 rounded-md border p-3">
      {fields?.map((f) => (
        <div key={f.name} className="space-y-1">
          <Label htmlFor={`${op}-${f.name}`}>{f.label}</Label>
          <Input
            id={`${op}-${f.name}`}
            name={f.name}
            type={f.type ?? "text"}
            placeholder={f.placeholder}
            required
          />
        </div>
      ))}
      <Button type="submit" variant={variant} disabled={pending} className="w-full">
        {label}
      </Button>
      {state && <Alert variant={state.ok ? "success" : "destructive"}>{state.message}</Alert>}
    </form>
  );
}

export function Operations({
  tenantId,
  status,
  cancelScheduled,
}: {
  tenantId: string;
  status: string;
  cancelScheduled: boolean;
}) {
  return (
    <Card className="space-y-3">
      <CardTitle>Acciones</CardTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {status !== "suspended" && status !== "cancelled" && (
          <Op
            tenantId={tenantId}
            op="suspend"
            label="Suspender (solo lectura)"
            variant="destructive"
            fields={[
              {
                name: "reason",
                label: "Motivo",
                placeholder: "Falta de pago, solicitud del cliente…",
              },
            ]}
          />
        )}
        {(status === "suspended" || status === "cancelled" || status === "past_due") && (
          <Op tenantId={tenantId} op="reactivate" label="Reactivar" variant="secondary" />
        )}
        <Op
          tenantId={tenantId}
          op="extend_trial"
          label="Extender prueba"
          fields={[{ name: "days", label: "Días a extender", type: "number" }]}
        />
        <Op
          tenantId={tenantId}
          op="free_months"
          label="Conceder meses gratis"
          fields={[{ name: "months", label: "Meses", type: "number" }]}
        />
        {status === "active" && !cancelScheduled && (
          <Op
            tenantId={tenantId}
            op="cancel_period_end"
            label="Cancelar al final del periodo"
            variant="outline"
          />
        )}
        {status !== "cancelled" && (
          <Op tenantId={tenantId} op="cancel_now" label="Cancelar ahora" variant="destructive" />
        )}
      </div>
    </Card>
  );
}
