"use client";
import Image from "next/image";
import QRCode from "qrcode";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

/** Activación de TOTP (obligatoria para SUPER ADMIN): contraseña → QR → verificación → códigos de respaldo. */
export function EnableTwoFactor() {
  const [step, setStep] = useState<"password" | "verify" | "done">("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qr, setQr] = useState<string>();
  const [backup, setBackup] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await authClient.twoFactor.enable({ password });
    if (res.error || !res.data) return setError("Contraseña incorrecta.");
    if (!("totpURI" in res.data)) return setError("El método TOTP no está disponible.");
    setQr(await QRCode.toDataURL(res.data.totpURI, { margin: 1, width: 220 }));
    setBackup(res.data.backupCodes);
    setStep("verify");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await authClient.twoFactor.verifyTotp({ code: code.trim() });
    if (res.error) return setError("Código incorrecto.");
    setStep("done");
  }

  if (step === "done") {
    return (
      <div className="space-y-4">
        <Alert variant="success">
          2FA activado. Guarda estos códigos de respaldo en un lugar seguro: cada uno sirve una vez.
        </Alert>
        <ul className="bg-muted grid grid-cols-2 gap-2 rounded-md p-3 font-mono text-sm">
          {backup.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <Button className="w-full" onClick={() => (window.location.href = "/")}>
          Continuar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive">{error}</Alert>}
      {step === "password" ? (
        <form onSubmit={start} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pw">Confirma tu contraseña</Label>
            <Input
              id="pw"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full">
            Generar código QR
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <p className="text-sm">
            Escanea el código con Google Authenticator, Microsoft Authenticator o similar, e ingresa
            el código de 6 dígitos.
          </p>
          {qr && (
            <Image
              src={qr}
              unoptimized
              alt="Código QR para configurar la app de autenticación"
              width={220}
              height={220}
              className="mx-auto rounded bg-white p-2"
            />
          )}
          <div className="space-y-1.5">
            <Label htmlFor="otp">Código de 6 dígitos</Label>
            <Input
              id="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full">
            Activar
          </Button>
        </form>
      )}
    </div>
  );
}
