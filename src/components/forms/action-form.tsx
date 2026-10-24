"use client";
import { useActionState, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { FormState } from "@/lib/form-state";

export type FieldSpec = {
  name: string;
  label: string;
  type?: "text" | "date" | "time" | "number" | "textarea" | "select" | "checkbox";
  options?: { value: string; label: string }[];
  required?: boolean;
  saved?: string | number | boolean | null;
  rows?: number;
  /** Para select: texto de la opción vacía (si se omite no hay opción vacía). */
  empty?: string;
};

const sel = "border-input bg-background min-h-11 w-full rounded-md border px-3 text-base";

/**
 * Formulario declarativo para acciones de servidor: campos como datos (se pasan desde un componente de servidor), mensaje de
 * éxito/error, errores por campo y valores repoblados. `idPrefix` evita ids duplicados cuando hay varios en la página.
 */
export function ActionForm({
  action,
  fields,
  submit,
  hidden = {},
  idPrefix = "",
  variant = "default",
}: {
  action: (prev: FormState, data: FormData) => Promise<FormState>;
  fields: FieldSpec[];
  submit: string;
  hidden?: Record<string, string>;
  idPrefix?: string;
  variant?: "default" | "outline";
}) {
  const [s, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-3">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const id = `${idPrefix}${f.name}`;
          const v = s?.values?.[f.name];
          const err = s?.fieldErrors?.[f.name];
          const errEl = err && (
            <p className="text-destructive text-sm" role="alert">
              {err}
            </p>
          );
          if (f.type === "checkbox")
            return (
              <label
                key={f.name}
                className="flex min-h-11 items-center gap-3 text-sm sm:col-span-2"
              >
                <input
                  type="checkbox"
                  name={f.name}
                  id={id}
                  defaultChecked={Boolean(f.saved)}
                  className="size-5"
                />
                {f.label}
              </label>
            );
          if (f.type === "select")
            return (
              <div key={f.name} className="space-y-1">
                <Label htmlFor={id}>{f.label}</Label>
                <Select
                  id={id}
                  name={f.name}
                  className={sel}
                  defaultValue={
                    typeof v === "string" ? v : String(f.saved ?? f.options?.[0]?.value ?? "")
                  }
                >
                  {f.empty !== undefined && <option value="">{f.empty}</option>}
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
                {errEl}
              </div>
            );
          if (f.type === "textarea") {
            const val = typeof v === "string" ? v : String(f.saved ?? "");
            return (
              <div key={f.name} className="space-y-1 sm:col-span-2">
                <Label htmlFor={id}>{f.label}</Label>
                <textarea
                  key={val}
                  id={id}
                  name={f.name}
                  rows={f.rows ?? 3}
                  defaultValue={val}
                  className="border-input bg-background w-full rounded-md border p-3 text-base"
                />
                {errEl}
              </div>
            );
          }
          return (
            <Field
              key={f.name}
              idPrefix={idPrefix}
              state={s}
              name={f.name}
              label={f.label}
              type={f.type ?? "text"}
              saved={typeof f.saved === "boolean" ? undefined : f.saved}
              required={f.required}
            />
          );
        })}
      </div>
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {submit}
      </Button>
    </form>
  );
}

/** Botón que ejecuta una acción de servidor sin formulario (retirar, cancelar, abrir…), con confirmación opcional. */
export function RunButton({
  action,
  arg,
  children,
  confirm: ask,
  variant = "outline",
}: {
  action: (arg: string) => Promise<FormState>;
  arg: string;
  children: React.ReactNode;
  confirm?: string;
  variant?: "default" | "outline";
}) {
  const [msg, setMsg] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col gap-1">
      {msg && !msg.ok && <span className="text-destructive text-xs">{msg.message}</span>}
      <Button
        variant={variant}
        size="sm"
        disabled={pending}
        onClick={() =>
          (!ask || window.confirm(ask)) && start(async () => setMsg(await action(arg)))
        }
      >
        {pending ? "Procesando…" : children}
      </Button>
    </span>
  );
}
