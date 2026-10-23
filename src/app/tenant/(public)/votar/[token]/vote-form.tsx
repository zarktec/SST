"use client";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { castVoteAction } from "./actions";

export function VoteForm({
  token,
  candidates,
  max,
}: {
  token: string;
  candidates: { id: string; name: string }[];
  max: number;
}) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [res, setRes] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  if (res?.ok) return <Alert variant="success">{res.message}</Alert>;
  const toggle = (id: string) =>
    setChosen((c) =>
      c.includes(id) ? c.filter((x) => x !== id) : c.length < max ? [...c, id] : c,
    );
  return (
    <div className="space-y-4">
      {res && <Alert variant="destructive">{res.message}</Alert>}
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">
          Elige hasta {max} candidato{max > 1 ? "s" : ""}
        </legend>
        {candidates.map((c) => (
          <label key={c.id} className="flex min-h-11 items-center gap-3 text-base">
            <input
              type={max === 1 ? "radio" : "checkbox"}
              name="candidate"
              className="size-5"
              checked={chosen.includes(c.id)}
              onChange={() => (max === 1 ? setChosen([c.id]) : toggle(c.id))}
            />{" "}
            {c.name}
          </label>
        ))}
      </fieldset>
      <p className="text-muted-foreground text-xs">
        Tu voto es secreto: no se guarda quién votó por quién.
      </p>
      <Button
        className="w-full"
        disabled={pending || chosen.length === 0}
        onClick={() =>
          window.confirm("Una vez enviado, tu voto no se puede cambiar. ¿Enviar?") &&
          start(async () => setRes(await castVoteAction(token, chosen)))
        }
      >
        {pending ? "Enviando…" : "Votar"}
      </Button>
    </div>
  );
}
