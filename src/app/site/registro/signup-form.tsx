"use client";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { signupAction } from "./actions";

export function SignupForm({ plan, root }: { plan?: string; root: string }) {
  const [s, action, pending] = useActionState(signupAction, null);
  if (s?.ok)
    return (
      <Alert variant="success">
        {s.message}{" "}
        {s.url && (
          <span>
            Tu dirección será <strong>{s.url.replace(/^https?:\/\//, "")}</strong>.
          </span>
        )}
      </Alert>
    );
  return (
    <form action={action} className="space-y-3">
      {s && <Alert variant="destructive">{s.message}</Alert>}
      <input type="hidden" name="plan" value={plan ?? ""} />
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="space-y-1">
        <Label htmlFor="legalName">Razón social o nombre</Label>
        <Input id="legalName" name="legalName" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tradeName">Nombre comercial</Label>
        <Input id="tradeName" name="tradeName" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor="nit">NIT o documento (sin DV, opcional)</Label>
        <Input id="nit" name="nit" inputMode="numeric" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="slug">Dirección de tu empresa</Label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">{root}/</span>
          <Input id="slug" name="slug" required placeholder="miempresa" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">Tu correo (administrador)</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creando…" : "Crear mi empresa"}
      </Button>
    </form>
  );
}
