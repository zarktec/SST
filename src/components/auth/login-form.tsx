"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Correo o contraseña incorrectos.",
  EMAIL_NOT_VERIFIED: "Debes confirmar tu correo. Te enviamos un nuevo enlace.",
  TOO_MANY_REQUESTS: "Demasiados intentos. Espera un minuto e inténtalo de nuevo.",
  handoff_invalid: "El enlace de ingreso venció o ya fue usado. Inicia sesión de nuevo.",
  forbidden: "Tu usuario no tiene acceso a esta empresa.",
  sso_required: "Esta empresa exige ingresar con Google o Microsoft.",
  not_invited: "Tu usuario no ha sido invitado a esta empresa.",
};

export function LoginForm({
  callbackURL,
  providers,
  socialBase,
  initialError,
  twoFactorPath = "/login/2fa",
}: {
  callbackURL: string;
  providers: { google: boolean; microsoft: boolean };
  /** URL base (en auth.) que inicia el flujo social: …/api/central/social?host=…&next=… */
  socialBase?: string;
  initialError?: string;
  twoFactorPath?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    initialError ? (MESSAGES[initialError] ?? "No se pudo iniciar sesión.") : null,
  );
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const fail = (code?: string, fallback = "No se pudo iniciar sesión.", status?: number) =>
    setError(status === 429 ? MESSAGES.TOO_MANY_REQUESTS : (code && MESSAGES[code]) || fallback);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "magic") {
        const res = await authClient.signIn.magicLink({ email, callbackURL });
        if (res.error) fail(res.error.code, undefined, res.error.status);
        else setSent(true);
      } else {
        const res = await authClient.signIn.email({ email, password, callbackURL });
        if (res.error) fail(res.error.code, undefined, res.error.status);
        else if ((res.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
          router.push(`${twoFactorPath}?callbackURL=${encodeURIComponent(callbackURL)}`);
        } else window.location.assign(callbackURL);
      }
    } finally {
      setBusy(false);
    }
  }

  const social = (provider: "google" | "microsoft") =>
    `${socialBase}${socialBase?.includes("?") ? "&" : "?"}provider=${provider}`;

  if (sent) {
    return (
      <Alert variant="success">
        Te enviamos un enlace de acceso a <strong>{email}</strong>. Vence en 10 minutos.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive">{error}</Alert>}
      <div className="bg-muted grid grid-cols-2 gap-1 rounded-md p-1" role="tablist">
        {(["password", "magic"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`min-h-11 rounded text-sm font-medium ${mode === m ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            {m === "password" ? "Contraseña" : "Enlace por correo"}
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {mode === "password" && (
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Un momento…" : mode === "password" ? "Ingresar" : "Enviarme el enlace"}
        </Button>
      </form>
      {socialBase && (providers.google || providers.microsoft) && (
        <div className="space-y-2">
          <p className="text-muted-foreground text-center text-xs">o continúa con</p>
          {providers.google && (
            <a
              href={social("google")}
              className="border-input hover:bg-muted flex min-h-11 items-center justify-center rounded-md border text-sm font-medium"
            >
              Google
            </a>
          )}
          {providers.microsoft && (
            <a
              href={social("microsoft")}
              className="border-input hover:bg-muted flex min-h-11 items-center justify-center rounded-md border text-sm font-medium"
            >
              Microsoft
            </a>
          )}
        </div>
      )}
    </div>
  );
}
