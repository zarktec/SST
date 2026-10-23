"use client";
import { useActionState, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import type { IntegrationView } from "@/integrations/registry/service";
import {
  clearSecretAction,
  replaceSecretAction,
  saveConfigAction,
  setActiveEnvAction,
  testConnectionAction,
  toggleEnabledAction,
  type ActionResult,
} from "../actions";

type Env = "sandbox" | "production";
const ENV_LABEL: Record<Env, string> = { sandbox: "Sandbox (pruebas)", production: "Producción" };

function Result({ r }: { r: ActionResult | null }) {
  if (!r) return null;
  return <Alert variant={r.ok ? "success" : "destructive"}>{r.message}</Alert>;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} onFocus={(e) => e.currentTarget.select()} />
        <Button variant="outline" onClick={() => navigator.clipboard.writeText(value)}>
          Copiar
        </Button>
      </div>
    </div>
  );
}

function SecretField({
  integration,
  env,
  field,
}: {
  integration: string;
  env: Env;
  field: IntegrationView["envs"][Env][number];
}) {
  const [state, action, pending] = useActionState(
    replaceSecretAction.bind(null, integration, env, field.name),
    null,
  );
  const [, start] = useTransition();
  return (
    <form action={action} className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={`${env}-${field.name}`}>
          {field.label}
          {field.required ? " *" : ""}
        </Label>
        {field.mask ? (
          <Badge variant="success">Guardado · {field.mask}</Badge>
        ) : (
          <Badge variant="warning">Sin configurar</Badge>
        )}
      </div>
      {field.help && <p className="text-muted-foreground text-xs">{field.help}</p>}
      <Input
        id={`${env}-${field.name}`}
        name="value"
        type="password"
        autoComplete="off"
        placeholder={
          field.mask ? "Escribe para reemplazar (no se puede leer el actual)" : "Pega el secreto"
        }
        required
      />
      {field.hasExpiry && (
        <div className="space-y-1">
          <Label htmlFor={`${env}-${field.name}-exp`}>
            Fecha de vencimiento (para alertarte antes)
          </Label>
          <Input
            id={`${env}-${field.name}-exp`}
            name="expiresAt"
            type="date"
            defaultValue={field.expiresAt ? String(field.expiresAt).slice(0, 10) : ""}
          />
        </div>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {field.mask ? "Reemplazar" : "Guardar secreto"}
        </Button>
        {field.mask && (
          <Button
            variant="outline"
            onClick={() => start(() => clearSecretAction(integration, env, field.name))}
          >
            Eliminar
          </Button>
        )}
      </div>
      <Result r={state} />
    </form>
  );
}

function ConfigForm({
  integration,
  env,
  fields,
}: {
  integration: string;
  env: Env;
  fields: IntegrationView["envs"][Env];
}) {
  const config = fields.filter((f) => f.kind === "config");
  const [state, action, pending] = useActionState(
    saveConfigAction.bind(null, integration, env),
    null,
  );
  if (!config.length) return null;
  return (
    <form action={action} className="space-y-3">
      <input
        type="hidden"
        name="$booleans"
        value={config
          .filter((f) => f.type === "boolean")
          .map((f) => f.name)
          .join(",")}
      />
      {config.map((f) => (
        <div key={f.name} className="space-y-1">
          {f.type === "boolean" ? (
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                name={f.name}
                defaultChecked={Boolean(f.value)}
                className="size-5"
              />{" "}
              {f.label}
            </label>
          ) : (
            <>
              <Label htmlFor={`${env}-${f.name}`}>
                {f.label}
                {f.required ? " *" : ""}
              </Label>
              {f.type === "select" ? (
                <select
                  id={`${env}-${f.name}`}
                  name={f.name}
                  defaultValue={String(f.value ?? "")}
                  className="border-input bg-background min-h-11 w-full rounded-md border px-3 text-base"
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id={`${env}-${f.name}`}
                  name={f.name}
                  type={f.type === "number" ? "number" : f.type === "url" ? "url" : "text"}
                  defaultValue={f.value === undefined ? "" : String(f.value)}
                />
              )}
              {f.help && <p className="text-muted-foreground text-xs">{f.help}</p>}
            </>
          )}
        </div>
      ))}
      <Button type="submit" disabled={pending}>
        Guardar configuración
      </Button>
      <Result r={state} />
    </form>
  );
}

export function IntegrationEditor({ view }: { view: IntegrationView }) {
  const [env, setEnv] = useState<Env>(view.activeEnv);
  const [test, setTest] = useState<ActionResult | null>(null);
  const [toggle, setToggle] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const fields = view.envs[env];

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Estado</CardTitle>
            <p className="text-muted-foreground text-sm">{view.description}</p>
          </div>
          <Badge variant={view.enabled ? "success" : "default"}>
            {view.enabled ? "Activa" : "Inactiva"}
          </Badge>
        </div>
        <div className="space-y-1">
          <Label htmlFor="active-env">Ambiente activo (el que usa la plataforma)</Label>
          <select
            id="active-env"
            defaultValue={view.activeEnv}
            onChange={(e) => start(() => setActiveEnvAction(view.key, e.target.value))}
            className="border-input bg-background min-h-11 w-full rounded-md border px-3 text-base"
          >
            <option value="sandbox">Sandbox (pruebas)</option>
            <option value="production">Producción</option>
          </select>
        </div>
        <Button
          variant={view.enabled ? "outline" : "default"}
          disabled={pending}
          onClick={() =>
            start(async () => setToggle(await toggleEnabledAction(view.key, !view.enabled)))
          }
        >
          {view.enabled ? "Desactivar integración" : "Activar integración"}
        </Button>
        <Result r={toggle} />
        {view.helpers.map((h) => (
          <CopyRow key={h.label} label={h.label} value={h.value} />
        ))}
      </Card>

      <div
        className="bg-muted grid grid-cols-2 gap-1 rounded-md p-1"
        role="tablist"
        aria-label="Ambiente a editar"
      >
        {(["sandbox", "production"] as const).map((e) => (
          <button
            key={e}
            type="button"
            role="tab"
            aria-selected={env === e}
            onClick={() => {
              setEnv(e);
              setTest(null);
            }}
            className={`min-h-11 rounded text-sm font-medium ${env === e ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            {ENV_LABEL[e]}
          </button>
        ))}
      </div>

      <Card className="space-y-4">
        <CardTitle>Configuración · {ENV_LABEL[env]}</CardTitle>
        <ConfigForm key={`${env}-cfg`} integration={view.key} env={env} fields={fields} />
        <div className="space-y-3">
          {fields
            .filter((f) => f.kind === "secret")
            .map((f) => (
              <SecretField key={`${env}-${f.name}`} integration={view.key} env={env} field={f} />
            ))}
        </div>
        <div className="space-y-2 border-t pt-4">
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => start(async () => setTest(await testConnectionAction(view.key, env)))}
          >
            Probar conexión ({env === "sandbox" ? "sandbox" : "producción"})
          </Button>
          <Result r={test} />
        </div>
      </Card>
    </div>
  );
}
