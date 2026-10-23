"use client";
import { useActionState, useMemo, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { PLAN_MODULES } from "@/core/plans/modules";
import { priceBreakdown } from "@/modules/platform/plans/rules";
import type { FormState } from "./actions";

export type PlanFormValues = {
  key: string;
  name: string;
  description: string;
  isTrial: boolean;
  trialDays: number | null;
  vatEnabled: boolean;
  vatIncluded: boolean;
  vatRatePercent: number;
  limits: {
    workers: number | null;
    users: number | null;
    centers: number | null;
    storageMb: number | null;
  };
  modules: string[];
  visible: boolean;
  sortOrder: number;
  active: boolean;
  monthlyPesos: number | null;
  annualPesos: number | null;
  monthlySiigoCode: string | null;
  annualSiigoCode: string | null;
};

const cop = (cents: bigint) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Number(cents / 100n));

function Check({
  name,
  label,
  defaultChecked,
  onChange,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="size-5"
      />{" "}
      {label}
    </label>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

/** Vista previa de lo que verá el cliente según el IVA configurado. */
function Preview({
  label,
  pesos,
  vat,
}: {
  label: string;
  pesos: number | null;
  vat: { enabled: boolean; included: boolean; rateBp: number };
}) {
  if (pesos === null || Number.isNaN(pesos)) return null;
  const b = priceBreakdown(BigInt(pesos) * 100n, vat);
  return (
    <p className="text-muted-foreground text-xs">
      {label}: neto {cop(b.netCents)} + IVA {cop(b.vatCents)} ={" "}
      <strong className="text-foreground">total {cop(b.totalCents)}</strong>
    </p>
  );
}

export function PlanForm({
  action,
  initial,
  isNew,
  extra,
}: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  initial: PlanFormValues;
  isNew: boolean;
  extra?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [vatEnabled, setVatEnabled] = useState(initial.vatEnabled);
  const [vatIncluded, setVatIncluded] = useState(initial.vatIncluded);
  const [rate, setRate] = useState(String(initial.vatRatePercent));
  const [monthly, setMonthly] = useState(
    initial.monthlyPesos === null ? "" : String(initial.monthlyPesos),
  );
  const [annual, setAnnual] = useState(
    initial.annualPesos === null ? "" : String(initial.annualPesos),
  );
  const [isTrial, setIsTrial] = useState(initial.isTrial);
  const vat = useMemo(
    () => ({
      enabled: vatEnabled,
      included: vatEnabled && vatIncluded,
      rateBp: Math.round((Number(rate) || 0) * 100),
    }),
    [vatEnabled, vatIncluded, rate],
  );
  const err = state?.fieldErrors ?? {};
  const toNum = (s: string) => (s.trim() === "" ? null : Number(s.replace(/[.\s$]/g, "")));
  const lim = (v: number | null) => (v === null ? "" : String(v));

  return (
    <form action={formAction} className="space-y-4">
      {state && <Alert variant={state.ok ? "success" : "destructive"}>{state.message}</Alert>}

      <Card className="space-y-3">
        <CardTitle>General</CardTitle>
        {isNew && (
          <Field
            id="key"
            label="Clave (única, no se puede cambiar)"
            error={err.key}
            hint="Ej.: profesional, empresarial"
          >
            <Input id="key" name="key" defaultValue={initial.key} required />
          </Field>
        )}
        <Field id="name" label="Nombre" error={err.name}>
          <Input id="name" name="name" defaultValue={initial.name} required />
        </Field>
        <Field id="description" label="Descripción" error={err.description}>
          <Input id="description" name="description" defaultValue={initial.description} />
        </Field>
        <Check
          name="visible"
          label="Visible en la página de precios"
          defaultChecked={initial.visible}
        />
        <Check name="active" label="Activo (se puede contratar)" defaultChecked={initial.active} />
        <Field id="sortOrder" label="Orden en la página de precios" error={err.sortOrder}>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            min={0}
            defaultValue={initial.sortOrder}
          />
        </Field>
      </Card>

      <Card className="space-y-3">
        <CardTitle>Prueba gratuita</CardTitle>
        <Check
          name="isTrial"
          label="Es el plan de prueba gratuita del registro (solo uno)"
          defaultChecked={initial.isTrial}
          onChange={setIsTrial}
        />
        <Field
          id="trialDays"
          label={
            isTrial ? "Duración de la prueba (días)" : "Días de prueba al contratar (opcional)"
          }
          error={err.trialDays}
        >
          <Input
            id="trialDays"
            name="trialDays"
            type="number"
            min={0}
            max={365}
            defaultValue={initial.trialDays ?? ""}
          />
        </Field>
      </Card>

      {!isTrial && (
        <Card className="space-y-3">
          <CardTitle>Precio e IVA</CardTitle>
          <p className="text-muted-foreground text-sm">
            Ofrece el plan mensual, anual o ambos, cada uno con su precio. Deja vacío el que no
            ofrezcas.
          </p>
          <Field id="monthlyPesos" label="Precio mensual (COP)" error={err.monthlyPesos}>
            <Input
              id="monthlyPesos"
              name="monthlyPesos"
              inputMode="numeric"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              placeholder="200000"
            />
          </Field>
          <Field
            id="annualPesos"
            label="Precio anual (COP)"
            error={err.annualPesos}
            hint="Normalmente con descuento frente a 12 mensualidades."
          >
            <Input
              id="annualPesos"
              name="annualPesos"
              inputMode="numeric"
              value={annual}
              onChange={(e) => setAnnual(e.target.value)}
            />
          </Field>
          <Check
            name="vatEnabled"
            label="Este plan cobra IVA"
            defaultChecked={initial.vatEnabled}
            onChange={setVatEnabled}
          />
          {vatEnabled && (
            <>
              <Field id="vatRatePercent" label="Tarifa de IVA (%)" error={err.vatRatePercent}>
                <Input
                  id="vatRatePercent"
                  name="vatRatePercent"
                  inputMode="decimal"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
              </Field>
              <Check
                name="vatIncluded"
                label="El precio ya incluye IVA"
                defaultChecked={initial.vatIncluded}
                onChange={setVatIncluded}
              />
              {err.vatIncluded && <p className="text-destructive text-xs">{err.vatIncluded}</p>}
            </>
          )}
          <div className="bg-muted space-y-1 rounded-md p-3">
            <Preview label="Mensual" pesos={toNum(monthly)} vat={vat} />
            <Preview label="Anual" pesos={toNum(annual)} vat={vat} />
          </div>
          <Field id="monthlySiigoCode" label="Código de producto en Siigo (mensual)">
            <Input
              id="monthlySiigoCode"
              name="monthlySiigoCode"
              defaultValue={initial.monthlySiigoCode ?? ""}
            />
          </Field>
          <Field id="annualSiigoCode" label="Código de producto en Siigo (anual)">
            <Input
              id="annualSiigoCode"
              name="annualSiigoCode"
              defaultValue={initial.annualSiigoCode ?? ""}
            />
          </Field>
        </Card>
      )}

      <Card className="space-y-3">
        <CardTitle>Límites</CardTitle>
        <p className="text-muted-foreground text-sm">
          Deja vacío para ilimitado. Se aplican en el servidor.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="limitWorkers" label="Trabajadores">
            <Input
              id="limitWorkers"
              name="limitWorkers"
              inputMode="numeric"
              defaultValue={lim(initial.limits.workers)}
            />
          </Field>
          <Field id="limitUsers" label="Usuarios">
            <Input
              id="limitUsers"
              name="limitUsers"
              inputMode="numeric"
              defaultValue={lim(initial.limits.users)}
            />
          </Field>
          <Field id="limitCenters" label="Sedes">
            <Input
              id="limitCenters"
              name="limitCenters"
              inputMode="numeric"
              defaultValue={lim(initial.limits.centers)}
            />
          </Field>
          <Field id="limitStorageMb" label="Almacenamiento (MB)">
            <Input
              id="limitStorageMb"
              name="limitStorageMb"
              inputMode="numeric"
              defaultValue={lim(initial.limits.storageMb)}
            />
          </Field>
        </div>
      </Card>

      <Card className="space-y-1">
        <CardTitle>Módulos incluidos</CardTitle>
        {PLAN_MODULES.map((m) => (
          <Check
            key={m.key}
            name={`module_${m.key}`}
            label={m.label}
            defaultChecked={initial.modules.includes(m.key)}
          />
        ))}
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {isNew ? "Crear plan" : "Guardar cambios"}
        </Button>
        {extra}
      </div>
    </form>
  );
}
