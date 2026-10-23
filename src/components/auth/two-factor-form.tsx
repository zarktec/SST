"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

/** Segundo factor (TOTP) durante el inicio de sesión. */
export function TwoFactorForm() {
  const params = useSearchParams();
  const raw = params.get("callbackURL") ?? "/";
  const callbackURL = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await authClient.twoFactor.verifyTotp({ code: code.trim() });
    setBusy(false);
    if (res.error) setError("Código incorrecto o vencido.");
    else window.location.assign(callbackURL);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && <Alert variant="destructive">{error}</Alert>}
      <div className="space-y-1.5">
        <Label htmlFor="code">Código de tu app de autenticación</Label>
        <Input
          id="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        Verificar
      </Button>
    </form>
  );
}
