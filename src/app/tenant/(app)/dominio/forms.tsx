"use client";
import { useTransition } from "react";
import { useActionState } from "@/components/forms/use-form-state";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { connectDomainAction, verifyDomainsAction } from "./actions";

export function ConnectDomainForm() {
  const [state, action, pending] = useActionState(connectDomainAction, null);
  return (
    <form action={action} className="space-y-3">
      {state && <Alert variant={state.ok ? "success" : "destructive"}>{state.message}</Alert>}
      <div className="space-y-1">
        <Label htmlFor="host">Tu dominio</Label>
        <Input
          id="host"
          name="host"
          required
          placeholder="sst.mi-empresa.com"
          defaultValue={String(state?.values?.host ?? "")}
          autoCapitalize="none"
          spellCheck={false}
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Registrando…" : "Conectar dominio"}
      </Button>
    </form>
  );
}

export function VerifyButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => start(() => void verifyDomainsAction())}
    >
      {pending ? "Verificando…" : "Verificar ahora"}
    </Button>
  );
}
