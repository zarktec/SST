"use client";
import { useActionState } from "@/components/forms/use-form-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { createTenantAction } from "../actions";

export function NewTenantForm({
  plans,
}: {
  plans: { id: string; name: string; isTrial: boolean }[];
}) {
  const [state, action, pending] = useActionState(createTenantAction, null);
  return (
    <>
      <form action={action} className="space-y-3">
        {state && !state.ok && <Alert variant="destructive">{state.message}</Alert>}
        <div className="space-y-1">
          <Label htmlFor="tradeName">Nombre comercial</Label>
          <Input id="tradeName" name="tradeName" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="legalName">Razón social</Label>
          <Input id="legalName" name="legalName" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="nit">NIT (sin dígito de verificación)</Label>
          <Input id="nit" name="nit" inputMode="numeric" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="slug">Identificador en la dirección</Label>
          <Input
            id="slug"
            name="slug"
            required
            pattern="[a-z0-9][a-z0-9\-]{1,61}[a-z0-9]"
            placeholder="mi-empresa"
          />
          <p className="text-muted-foreground text-xs">
            Quedará como sst.zark.pro/<strong>identificador</strong>
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="ownerEmail">Correo del administrador (recibirá la invitación)</Label>
          <Input id="ownerEmail" name="ownerEmail" type="email" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="planId">Plan inicial</Label>
          <select
            id="planId"
            name="planId"
            className="border-input bg-background min-h-11 w-full rounded-md border px-3 text-base"
          >
            <option value="">Prueba gratuita (por defecto)</option>
            {plans
              .filter((p) => !p.isTrial)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
        <Button type="submit" disabled={pending}>
          Crear empresa
        </Button>
      </form>
    </>
  );
}
