"use client";
import { useRouter } from "next/navigation";
import { useActionState, useCallback, useEffect, useState, useTransition } from "react";
import { useBasePath, useTenantPath } from "@/components/layout/base-path";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { FormState } from "@/lib/form-state";
import {
  enqueue,
  flushQueue,
  listQueue,
  removeFromQueue,
  send,
  type QueuedInspection,
} from "@/lib/offline-queue";
import { submissionErrors } from "@/modules/inspections/rules";
import { importTemplateAction, templateAction, toggleTemplateAction } from "./actions";

const sel = "border-input bg-background min-h-11 w-full rounded-md border px-3 text-base";
type Item = { id: string; text: string; required: boolean };
type Opt = { id: string; name: string };

export function TemplateForm({
  id,
  initial,
}: {
  id?: string;
  initial?: { name: string; category: string; itemsText: string };
}) {
  const [s, action, pending] = useActionState(templateAction, null);
  return (
    <form action={action} className="space-y-3">
      {id && <input type="hidden" name="id" value={id} />}
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          idPrefix={`${id ?? "n"}-`}
          state={s}
          saved={initial?.name}
          name="name"
          label="Nombre"
        />
        <Field
          idPrefix={`${id ?? "n"}-`}
          state={s}
          saved={initial?.category}
          name="category"
          label="Categoría"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id ?? "n"}-itemsText`}>
          Ítems (uno por línea; empieza con * si es obligatorio)
        </Label>
        <textarea
          id={`${id ?? "n"}-itemsText`}
          name="itemsText"
          rows={6}
          defaultValue={
            typeof s?.values?.itemsText === "string"
              ? s.values.itemsText
              : (initial?.itemsText ?? "")
          }
          className="border-input bg-background w-full rounded-md border p-3 text-base"
        />
        {s?.fieldErrors?.itemsText && (
          <p className="text-destructive text-sm" role="alert">
            {s.fieldErrors.itemsText}
          </p>
        )}
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        Guardar plantilla
      </Button>
    </form>
  );
}

export function RowButton({
  run,
  children,
}: {
  run: () => Promise<FormState>;
  children: React.ReactNode;
}) {
  const [msg, setMsg] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col gap-1">
      {msg && !msg.ok && <span className="text-destructive text-xs">{msg.message}</span>}
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => start(async () => setMsg(await run()))}
      >
        {children}
      </Button>
    </span>
  );
}
export const ToggleTemplate = ({ id, active }: { id: string; active: boolean }) => (
  <RowButton run={() => toggleTemplateAction(id, !active)}>
    {active ? "Desactivar" : "Activar"}
  </RowButton>
);
export const ImportTemplate = ({ code }: { code: string }) => (
  <RowButton run={() => importTemplateAction(code)}>Importar</RowButton>
);

/**
 * Cola sin conexión: envía lo pendiente al montar y cuando vuelve la red, y deja reintentar a mano. También precarga las
 * pantallas de ejecución y sus archivos para que abran sin conexión (el service worker las guarda).
 */
export function SyncStatus({ warm = [] }: { warm?: string[] }) {
  const router = useRouter();
  const base = useBasePath();
  const [items, setItems] = useState<QueuedInspection[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const refresh = useCallback(
    () =>
      listQueue(base)
        .then(setItems)
        .catch(() => undefined),
    [base],
  );
  const sync = useCallback(async () => {
    setBusy(true);
    try {
      const r = await flushQueue(base);
      if (r.sent) {
        setMsg(`${r.sent} inspección(es) sincronizada(s).`);
        router.refresh();
      }
    } finally {
      setBusy(false);
      refresh();
    }
  }, [base, refresh, router]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza con IndexedDB al montar
    sync();
    const on = () => sync();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [sync]);
  useEffect(() => {
    if (!navigator.onLine) return;
    (async () => {
      for (const url of warm) {
        try {
          const html = await (
            await fetch(`${base}${url}`, { headers: { "x-sst-prefetch": "1" } })
          ).text();
          const assets = new Set(html.match(/\/_next\/static\/[^"'\\\s)]+\.(?:js|css)/g) ?? []);
          await Promise.all([...assets].map((a) => fetch(a).catch(() => undefined)));
        } catch {
          /* sin red: se reintenta en la próxima visita */
        }
      }
    })();
  }, [base, warm]);
  const pending = items.filter((i) => !i.error);
  const rejected = items.filter((i) => i.error);
  if (!items.length && !msg) return null;
  return (
    <Alert variant={rejected.length ? "destructive" : "info"}>
      <div className="space-y-2 text-sm">
        {msg && <p>{msg}</p>}
        {pending.length > 0 && (
          <p>
            {pending.length} inspección(es) guardada(s) en este dispositivo pendiente(s) de enviar.{" "}
            <Button size="sm" variant="outline" disabled={busy} onClick={sync}>
              Sincronizar ahora
            </Button>
          </p>
        )}
        {rejected.map((i) => (
          <p key={i.offlineId}>
            Rechazada: {i.error}{" "}
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await removeFromQueue(i.offlineId);
                refresh();
              }}
            >
              Descartar
            </Button>
          </p>
        ))}
      </div>
    </Alert>
  );
}

type Answer = { result: "ok" | "fail" | "na" | ""; note: string };
export function Runner({
  template,
  centers,
}: {
  template: { id: string; name: string; items: Item[] };
  centers: Opt[];
}) {
  const router = useRouter();
  const tp = useTenantPath();
  const base = useBasePath();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [place, setPlace] = useState("");
  const [center, setCenter] = useState("");
  const [notes, setNotes] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (id: string, patch: Partial<Answer>) =>
    setAnswers((a) => ({ ...a, [id]: { ...(a[id] ?? { result: "", note: "" }), ...patch } }));

  async function submit() {
    const results = template.items
      .filter((i) => answers[i.id]?.result)
      .map((i) => ({
        itemId: i.id,
        result: answers[i.id].result,
        note: answers[i.id].note.trim() || null,
      }));
    const errors = submissionErrors(template.items, results);
    if (place.trim().length < 2) errors.unshift("Indica el lugar");
    if (!results.length) errors.push("Responde al menos un ítem");
    if (errors.length) return setMsg({ ok: false, text: errors.join(". ") });
    const payload = {
      offlineId: crypto.randomUUID(),
      templateId: template.id,
      performedAt: new Date().toISOString(),
      place: place.trim(),
      workCenterId: center || null,
      notes: notes.trim() || null,
      results,
    };
    setBusy(true);
    const r = await send(payload, base);
    if (r.result === "sent") {
      setMsg({ ok: true, text: "Inspección enviada." });
      router.push(tp("/inspecciones"));
      router.refresh();
    } else if (r.result === "rejected") {
      setMsg({ ok: false, text: r.message ?? "El servidor rechazó la inspección." });
    } else {
      await enqueue({
        offlineId: payload.offlineId,
        base,
        payload,
        queuedAt: new Date().toISOString(),
      });
      setMsg({
        ok: true,
        text: "Sin conexión: la inspección quedó guardada en este dispositivo y se enviará al reconectar.",
      });
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      {msg && <Alert variant={msg.ok ? "success" : "destructive"}>{msg.text}</Alert>}
      <div className="space-y-1">
        <Label htmlFor="place">Lugar</Label>
        <input
          id="place"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          className={sel}
        />
      </div>
      {centers.length > 1 && (
        <div className="space-y-1">
          <Label htmlFor="center">Sede</Label>
          <Select
            id="center"
            className={sel}
            value={center}
            onChange={(e) => setCenter(e.target.value)}
          >
            <option value="">—</option>
            {centers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      <ol className="space-y-4">
        {template.items.map((i) => {
          const a = answers[i.id] ?? { result: "", note: "" };
          return (
            <li key={i.id} className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-semibold">
                {i.text}
                {i.required && <span className="text-destructive"> *</span>}
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label={i.text}>
                {(
                  [
                    ["ok", "Cumple"],
                    ["fail", "No cumple"],
                    ["na", "No aplica"],
                  ] as const
                ).map(([v, label]) => (
                  <Button
                    key={v}
                    type="button"
                    size="sm"
                    variant={a.result === v ? "default" : "outline"}
                    aria-pressed={a.result === v}
                    onClick={() => set(i.id, { result: v })}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              {a.result === "fail" && (
                <textarea
                  aria-label={`Hallazgo: ${i.text}`}
                  placeholder="Describe el hallazgo"
                  value={a.note}
                  onChange={(e) => set(i.id, { note: e.target.value })}
                  rows={2}
                  className="border-input bg-background w-full rounded-md border p-3 text-base"
                />
              )}
            </li>
          );
        })}
      </ol>
      <div className="space-y-1">
        <Label htmlFor="notes">Observaciones generales</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="border-input bg-background w-full rounded-md border p-3 text-base"
        />
      </div>
      <p className="text-muted-foreground text-xs">
        Si no hay conexión, la inspección se guarda en este dispositivo y se envía sola al
        reconectar. Las fotos se podrán adjuntar cuando se habilite el almacenamiento de archivos.
      </p>
      <Button onClick={submit} disabled={busy}>
        Enviar inspección
      </Button>
    </div>
  );
}
