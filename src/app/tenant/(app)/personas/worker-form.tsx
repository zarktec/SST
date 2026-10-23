"use client";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/input";
import type { FormState } from "@/lib/form-state";
import { CONTRACT_TYPES, KINDS } from "@/modules/workers/rules";
import { retireWorkerAction, saveWorkerAction, ssCheckAction } from "./actions";

type Row = Record<string, string | number | null | undefined>;
const sel = "border-input bg-background min-h-11 w-full rounded-md border px-3 text-base";

function Select({
  name,
  label,
  state,
  saved,
  children,
}: {
  name: string;
  label: string;
  state: FormState;
  saved?: string | null;
  children: React.ReactNode;
}) {
  const v = state?.values?.[name];
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        className={sel}
        defaultValue={typeof v === "string" ? v : (saved ?? "")}
      >
        {children}
      </select>
    </div>
  );
}

export function WorkerForm({
  worker,
  centers,
}: {
  worker?: Row;
  centers: { id: string; name: string }[];
}) {
  const [s, action, pending] = useActionState(saveWorkerAction, null);
  const f = (
    name: string,
    label: string,
    extra: React.ComponentProps<typeof Field>["inputMode"] | object = {},
  ) => (
    <Field
      state={s}
      saved={worker?.[name] as string | number | null | undefined}
      name={name}
      label={label}
      {...(extra as object)}
    />
  );
  return (
    <form action={action} className="space-y-3">
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      {worker?.id && <input type="hidden" name="id" value={String(worker.id)} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Select name="kind" label="Vinculación" state={s} saved={worker?.kind as string}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
        <Select
          name="idType"
          label="Tipo de documento"
          state={s}
          saved={(worker?.idType as string) ?? "13"}
        >
          <option value="13">Cédula de ciudadanía</option>
          <option value="22">Cédula de extranjería</option>
          <option value="12">Tarjeta de identidad</option>
          <option value="41">Pasaporte</option>
          <option value="42">Documento extranjero (PEP)</option>
          <option value="31">NIT</option>
        </Select>
        {f("idNumber", "Número de documento", { inputMode: "numeric", required: true })}
        {f("fullName", "Nombre completo", { required: true })}
        {f("email", "Correo", { type: "email" })}
        {f("phone", "Teléfono", { inputMode: "tel" })}
        {f("position", "Cargo")}
        {f("area", "Área")}
        <Select name="workCenterId" label="Sede" state={s} saved={worker?.workCenterId as string}>
          <option value="">Sin sede</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select
          name="contractType"
          label="Tipo de contrato"
          state={s}
          saved={worker?.contractType as string}
        >
          <option value="">—</option>
          {CONTRACT_TYPES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        {f("startDate", "Fecha de ingreso", { type: "date", required: true })}
        {f("endDate", "Fecha de retiro", { type: "date" })}
        {f("eps", "EPS")}
        {f("afp", "AFP")}
        {f("arl", "ARL")}
        {f("arlRiskClass", "Clase de riesgo ARL (1 a 5)", { inputMode: "numeric" })}
        {f("ccf", "Caja de compensación")}
        {f("contractorCompany", "Empresa contratista (si aplica)")}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : worker?.id ? "Guardar cambios" : "Registrar"}
      </Button>
    </form>
  );
}

export function RetireForm({ id, start }: { id: string; start: string }) {
  const [s, action, pending] = useActionState(retireWorkerAction, null);
  return (
    <form action={action} className="space-y-3">
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <input type="hidden" name="id" value={id} />
      <Field
        idPrefix="retire-"
        state={s}
        name="endDate"
        label="Registrar retiro con fecha"
        type="date"
        min={start}
        required
      />
      <Button type="submit" variant="outline" disabled={pending}>
        Registrar retiro
      </Button>
    </form>
  );
}

export function SsCheckForm({ id, period }: { id: string; period: string }) {
  const [s, action, pending] = useActionState(ssCheckAction, null);
  return (
    <form action={action} className="space-y-3">
      {s && <Alert variant={s.ok ? "success" : "destructive"}>{s.message}</Alert>}
      <input type="hidden" name="id" value={id} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          idPrefix="ss-"
          state={s}
          saved={period}
          name="period"
          label="Periodo (AAAA-MM)"
          required
        />
        <Select name="paid" label="Pago de seguridad social" state={s} saved="yes">
          <option value="yes">Pagado</option>
          <option value="no">No pagado</option>
        </Select>
        <Field idPrefix="ss-" state={s} name="note" label="Observación (planilla, soporte)" />
      </div>
      <Button type="submit" disabled={pending}>
        Registrar verificación
      </Button>
    </form>
  );
}
