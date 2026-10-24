"use client";
import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { useTenantPath } from "@/components/layout/base-path";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { FormState } from "@/lib/form-state";
import {
  addCandidateAction,
  applyElectionAction,
  closeCommitmentAction,
  closeVotingAction,
  conformAction,
  createElectionAction,
  minutesAction,
  openVotingAction,
  resolveTieAction,
} from "./actions";

const sel = "border-input bg-background min-h-11 w-full rounded-md border px-3 text-base";
const today = () => new Date().toISOString().slice(0, 10);
type Person = { id: string; name: string };

export function ActionButton({
  run,
  children,
  confirm: ask,
  variant = "outline",
}: {
  run: () => Promise<FormState>;
  children: React.ReactNode;
  confirm?: string;
  variant?: "default" | "outline";
}) {
  const [msg, setMsg] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      {msg && <Alert variant={msg.ok ? "success" : "destructive"}>{msg.message}</Alert>}
      <Button
        variant={variant}
        size="sm"
        disabled={pending}
        onClick={() => (!ask || window.confirm(ask)) && start(async () => setMsg(await run()))}
      >
        {pending ? "Procesando…" : children}
      </Button>
    </div>
  );
}
export const CloseVotingButton = ({ id }: { id: string }) => (
  <ActionButton
    run={() => closeVotingAction(id)}
    confirm="Se cerrará la votación y se hará el escrutinio. ¿Continuar?"
    variant="default"
  >
    Cerrar votación y escrutar
  </ActionButton>
);
export const CandidateButton = ({
  electionId,
  workerId,
  name,
}: {
  electionId: string;
  workerId: string;
  name: string;
}) => (
  <ActionButton
    run={() => addCandidateAction(electionId, workerId)}
  >{`Inscribir a ${name}`}</ActionButton>
);

export function ConformForm({
  kind,
  people,
  centers,
}: {
  kind: "copasst" | "vigia" | "ccl";
  people: Person[];
  centers?: Person[];
}) {
  const [s, action, pending] = useActionState(conformAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <Field
        state={s}
        saved={today()}
        name="periodStart"
        label="Inicio del periodo"
        type="date"
        required
      />
      {kind === "ccl" && centers && (
        <div className="space-y-1">
          <Label htmlFor="workCenterId">Comité de</Label>
          <Select
            id="workCenterId"
            name="workCenterId"
            className={sel}
            defaultValue={typeof s?.values?.workCenterId === "string" ? s.values.workCenterId : ""}
          >
            <option value="">Comité central</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <p className="text-muted-foreground text-sm">
        Asigna a cada persona su representación y puesto (deja “—” a quien no integra el comité). La
        representación de los principales debe ser paritaria.
      </p>
      <ul className="divide-y">
        {people.map((p) => (
          <li key={p.id} className="grid items-center gap-2 py-2 sm:grid-cols-2">
            <Label htmlFor={`m-${p.id}`}>{p.name}</Label>
            <Select id={`m-${p.id}`} name={`member:${p.id}`} className={sel} defaultValue="">
              <option value="">—</option>
              <option value="employer:principal">Empleador · principal</option>
              <option value="employer:alternate">Empleador · suplente</option>
              <option value="workers:principal">Trabajadores · principal</option>
              <option value="workers:alternate">Trabajadores · suplente</option>
            </Select>
          </li>
        ))}
      </ul>
      <Button type="submit" disabled={pending}>
        Conformar comité
      </Button>
    </form>
  );
}

export function MinutesForm({ committeeId, members }: { committeeId: string; members: Person[] }) {
  const [s, action, pending] = useActionState(minutesAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="committeeId" value={committeeId} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          state={s}
          saved={today()}
          name="date"
          label="Fecha de la reunión"
          type="date"
          required
        />
        <Field state={s} name="agenda" label="Orden del día" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="content">Desarrollo y decisiones</Label>
        <textarea
          key={typeof s?.values?.content === "string" ? s.values.content : "c"}
          id="content"
          name="content"
          rows={5}
          defaultValue={typeof s?.values?.content === "string" ? s.values.content : ""}
          className="border-input bg-background w-full rounded-md border p-3 text-base"
        />
        {s?.fieldErrors?.content && (
          <p className="text-destructive text-sm" role="alert">
            {s.fieldErrors.content}
          </p>
        )}
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Asistentes</legend>
        {members.map((m) => (
          <label key={m.id} className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="attendeeIds"
              value={m.id}
              defaultChecked
              className="size-5"
            />{" "}
            {m.name}
          </label>
        ))}
      </fieldset>
      <div className="space-y-1">
        <Label htmlFor="commitments">
          Compromisos (uno por línea: descripción | responsable | AAAA-MM-DD)
        </Label>
        <textarea
          id="commitments"
          name="commitments"
          rows={3}
          defaultValue={typeof s?.values?.commitments === "string" ? s.values.commitments : ""}
          className="border-input bg-background w-full rounded-md border p-3 text-base"
        />
      </div>
      <Button type="submit" disabled={pending}>
        Registrar acta
      </Button>
    </form>
  );
}

export function CloseCommitmentForm({ id }: { id: string }) {
  const [s, action, pending] = useActionState(closeCommitmentAction, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="id" value={id} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <Field idPrefix={`${id}-`} state={s} name="note" label="Cómo se cumplió" />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Cerrar
      </Button>
    </form>
  );
}

export function ElectionForm({ kind }: { kind: "copasst" | "vigia" }) {
  const [s, action, pending] = useActionState(createElectionAction, null);
  const router = useRouter();
  const tp = useTenantPath();
  const created = s?.ok ? s.details?.[0] : undefined;
  useEffect(() => {
    if (created) router.push(tp(`/comites/elecciones/${created}`));
  }, [created, router, tp]);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      {s && (
        <Alert variant={s.ok ? "success" : "destructive"}>
          {s.message}{" "}
          {s.ok && s.details?.[0] && (
            <Link className="underline" href={`/comites/elecciones/${s.details[0]}`}>
              Ir a la elección
            </Link>
          )}
        </Alert>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          state={s}
          saved={1}
          name="principalSeats"
          label="Principales de los trabajadores"
          inputMode="numeric"
        />
        <Field state={s} saved={1} name="alternateSeats" label="Suplentes" inputMode="numeric" />
        <Field
          state={s}
          saved={today()}
          name="votingOpensOn"
          label="Apertura de la votación"
          type="date"
          required
        />
        <Field state={s} name="votingClosesOn" label="Cierre de la votación" type="date" required />
      </div>
      <Button type="submit" disabled={pending}>
        Convocar elección
      </Button>
    </form>
  );
}

export function OpenVoting({ electionId }: { electionId: string }) {
  const router = useRouter();
  const [links, setLinks] = useState<{ name: string; email: string | null; url: string }[] | null>(
    null,
  );
  const [msg, setMsg] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const csv = () => {
    const rows = [
      "Nombre,Correo,Enlace de votación",
      ...(links ?? []).map((l) => `"${l.name}","${l.email ?? ""}","${l.url}"`),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + rows], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "enlaces-de-votacion.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-3">
      {msg && <Alert variant={msg.ok ? "success" : "destructive"}>{msg.message}</Alert>}
      {!links && (
        <Button
          disabled={pending}
          onClick={() =>
            window.confirm(
              "Se generará un enlace personal por trabajador. Cierra la inscripción de candidatos. ¿Abrir la votación?",
            ) &&
            start(async () => {
              const r = await openVotingAction(electionId);
              setMsg(r);
              if (r.links) setLinks(r.links);
            })
          }
        >
          Cerrar inscripción y abrir votación
        </Button>
      )}
      {links && (
        <Alert variant="warning">
          <p className="font-medium">
            Descarga los enlaces ahora: por seguridad no se vuelven a mostrar. Los trabajadores con
            correo ya lo recibieron.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" onClick={csv}>
              Descargar enlaces (CSV)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                window.confirm("Los enlaces no se vuelven a mostrar. ¿Ya los descargaste?") &&
                router.refresh()
              }
            >
              Ya los descargué: continuar
            </Button>
          </div>
          <p className="mt-1 text-xs">
            {links.length} enlaces · {links.filter((l) => l.email).length} enviados por correo
          </p>
        </Alert>
      )}
    </div>
  );
}

export function TieForm({
  electionId,
  rows,
}: {
  electionId: string;
  rows: { candidateId: string; name: string; votes: number }[];
}) {
  const [s, action, pending] = useActionState(resolveTieAction, null);
  const [order, setOrder] = useState(rows.map((r) => r.candidateId));
  const move = (i: number, d: number) =>
    setOrder((o) => {
      const n = [...o];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });
  const by = new Map(rows.map((r) => [r.candidateId, r]));
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="electionId" value={electionId} />
      <input type="hidden" name="order" value={order.join(",")} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <p className="text-sm">
        Ordena a los candidatos según el sorteo o criterio del comité (no puede contradecir los
        votos).
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        {order.map((id, i) => (
          <li key={id}>
            {by.get(id)!.name} ({by.get(id)!.votes} votos){" "}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={i === 0}
              onClick={() => move(i, -1)}
              aria-label="Subir"
            >
              ↑
            </Button>{" "}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={i === order.length - 1}
              onClick={() => move(i, 1)}
              aria-label="Bajar"
            >
              ↓
            </Button>
          </li>
        ))}
      </ol>
      <Field state={s} name="note" label="Cómo se resolvió (obligatorio)" />
      <Button type="submit" disabled={pending}>
        Registrar resolución
      </Button>
    </form>
  );
}

export function ApplyForm({ electionId, people }: { electionId: string; people: Person[] }) {
  const [s, action, pending] = useActionState(applyElectionAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="electionId" value={electionId} />
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <Field
        state={s}
        saved={today()}
        name="periodStart"
        label="Inicio del periodo"
        type="date"
        required
      />
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">
          Representantes del empleador (principales: misma cantidad que los elegidos)
        </legend>
        {people.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-4 text-sm">
            <span className="min-w-40">{p.name}</span>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                name="employerPrincipal"
                aria-label={`Principal del empleador: ${p.name}`}
                value={p.id}
                className="size-5"
              />{" "}
              Principal
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                name="employerAlternate"
                aria-label={`Suplente del empleador: ${p.name}`}
                value={p.id}
                className="size-5"
              />{" "}
              Suplente
            </label>
          </div>
        ))}
      </fieldset>
      <Button type="submit" disabled={pending}>
        Conformar el comité con el resultado
      </Button>
      <p className="text-muted-foreground text-xs">
        Luego verás el comité en{" "}
        <Link href="/comites" className="underline">
          Comités
        </Link>
        .
      </p>
    </form>
  );
}
