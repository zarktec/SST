"use client";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { createCouponAction } from "../planes/actions";

export function CouponForm({ plans }: { plans: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createCouponAction, null);
  return (
    <Card>
      <CardTitle>Nuevo cupón</CardTitle>
      <form action={action} className="mt-3 space-y-3">
        {state && <Alert variant={state.ok ? "success" : "destructive"}>{state.message}</Alert>}
        <div className="space-y-1">
          <Label htmlFor="code">Código</Label>
          <Input id="code" name="code" required placeholder="BIENVENIDA10" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="description">Descripción</Label>
          <Input id="description" name="description" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="kind">Tipo</Label>
            <select
              id="kind"
              name="kind"
              className="border-input bg-background min-h-11 w-full rounded-md border px-3 text-base"
            >
              <option value="percent">Porcentaje</option>
              <option value="amount">Valor fijo (COP)</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="value">Valor (% o pesos)</Label>
            <Input id="value" name="value" inputMode="decimal" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="validFrom">Vigente desde</Label>
            <Input id="validFrom" name="validFrom" type="date" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="validTo">Vigente hasta</Label>
            <Input id="validTo" name="validTo" type="date" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="maxUses">Usos máximos (vacío = ilimitado)</Label>
            <Input id="maxUses" name="maxUses" inputMode="numeric" />
          </div>
        </div>
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">
            Aplica a (ninguno marcado = todos los planes)
          </legend>
          {plans.map((p) => (
            <label key={p.id} className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" name="planIds" value={p.id} className="size-5" /> {p.name}
            </label>
          ))}
        </fieldset>
        <Button type="submit" disabled={pending}>
          Crear cupón
        </Button>
      </form>
    </Card>
  );
}
