"use client";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { registerSourceAction } from "./actions";

type Props = {
  apiBaseUrl: string;
  publicKey: string;
  acceptanceToken: string;
  acceptanceUrl: string;
  personalAuthToken: string;
  personalAuthUrl: string;
};

/**
 * Tokeniza la tarjeta EN EL NAVEGADOR directo contra Wompi (llave pública): número y CVC nunca pasan por
 * nuestros servidores. Al servidor solo viaja el token y los datos de visualización (marca, últimos 4, vencimiento).
 */
export function CardForm(p: Props) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const [mm, yy] = String(f.get("exp"))
      .split("/")
      .map((s) => s.trim());
    start(async () => {
      try {
        const res = await fetch(`${p.apiBaseUrl}/tokens/cards`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.publicKey}` },
          body: JSON.stringify({
            number: String(f.get("number")).replace(/\s/g, ""),
            cvc: String(f.get("cvc")),
            exp_month: mm,
            exp_year: yy?.slice(-2),
            card_holder: String(f.get("holder")),
          }),
        });
        const body = await res.json();
        if (!res.ok || !body?.data?.id) {
          setMsg({ ok: false, text: "No pudimos validar la tarjeta. Revisa los datos." });
          return;
        }
        const d = body.data;
        const r = await registerSourceAction({
          token: d.id,
          acceptanceToken: p.acceptanceToken,
          personalAuthToken: p.personalAuthToken,
          display: {
            brand: d.brand,
            last4: d.last_four,
            expMonth: Number(d.exp_month),
            expYear: Number(d.exp_year),
            holder: d.name,
          },
        });
        setMsg({ ok: r?.ok ?? false, text: r?.message ?? "Listo" });
        if (r?.ok) form.reset();
      } catch {
        setMsg({ ok: false, text: "Error de conexión. Intenta de nuevo." });
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3" autoComplete="off">
      {msg && <Alert variant={msg.ok ? "success" : "destructive"}>{msg.text}</Alert>}
      <div className="space-y-1">
        <Label htmlFor="holder">Nombre en la tarjeta</Label>
        <Input id="holder" name="holder" required autoComplete="cc-name" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="number">Número de tarjeta</Label>
        <Input
          id="number"
          name="number"
          inputMode="numeric"
          required
          autoComplete="cc-number"
          maxLength={23}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="exp">Vence (MM/AA)</Label>
          <Input
            id="exp"
            name="exp"
            required
            placeholder="08/29"
            autoComplete="cc-exp"
            maxLength={7}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cvc">CVC</Label>
          <Input
            id="cvc"
            name="cvc"
            inputMode="numeric"
            required
            autoComplete="cc-csc"
            maxLength={4}
          />
        </div>
      </div>
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-1 size-5"
        />
        <span>
          Acepto los{" "}
          <a className="underline" href={p.acceptanceUrl} target="_blank" rel="noreferrer">
            términos de la pasarela
          </a>{" "}
          y la{" "}
          <a className="underline" href={p.personalAuthUrl} target="_blank" rel="noreferrer">
            autorización de datos personales
          </a>
          , y autorizo cobros recurrentes.
        </span>
      </label>
      <Button type="submit" disabled={pending || !accepted}>
        {pending ? "Validando…" : "Agregar tarjeta"}
      </Button>
    </form>
  );
}
