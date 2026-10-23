"use client";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/input";
import type { FormState } from "@/lib/form-state";
import {
  completeOnboardingAction,
  removeCenterAction,
  resolveAlertAction,
  saveBrandAction,
  saveCenterAction,
  saveCompanyAction,
  saveResponsibleAction,
} from "./actions";

type Row = Record<string, string | number | null | undefined>;
const sel = "border-input bg-background min-h-11 w-full rounded-md border px-3 text-base";

function Msg({ state }: { state: FormState }) {
  return state ? (
    <Alert variant={state.ok ? "success" : "destructive"}>{state.message}</Alert>
  ) : null;
}
function Submit({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Guardando…" : children}
    </Button>
  );
}

export function CompanyForm({
  saved,
  suggestedRisk,
}: {
  saved: Row;
  suggestedRisk?: number | null;
}) {
  const [s, action, pending] = useActionState(saveCompanyAction, null);
  return (
    <form action={action} className="space-y-3">
      <Msg state={s} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          state={s}
          saved={saved.nit}
          name="nit"
          label="NIT (sin DV ni puntos)"
          inputMode="numeric"
          required
        />
        <Field
          state={s}
          saved={saved.nitDv}
          name="nitDv"
          label="Dígito de verificación"
          inputMode="numeric"
          maxLength={1}
          required
        />
        <Field state={s} saved={saved.legalName} name="legalName" label="Razón social" required />
        <Field
          state={s}
          saved={saved.tradeName}
          name="tradeName"
          label="Nombre comercial"
          required
        />
        <Field
          state={s}
          saved={saved.ciiu}
          name="ciiu"
          label="Actividad económica (CIIU, 4 dígitos)"
          inputMode="numeric"
          maxLength={4}
          required
        />
        <Field
          state={s}
          saved={saved.riskClass ?? suggestedRisk}
          name="riskClass"
          label="Clase de riesgo (1 a 5)"
          inputMode="numeric"
          required
        />
        <Field state={s} saved={saved.arl} name="arl" label="ARL" required />
        <Field
          state={s}
          saved={saved.legalRepresentative}
          name="legalRepresentative"
          label="Representante legal"
          required
        />
        <Field
          state={s}
          saved={saved.workersCount}
          name="workersCount"
          label="Número de trabajadores"
          inputMode="numeric"
          required
        />
      </div>
      <Submit pending={pending}>Guardar y clasificar</Submit>
    </form>
  );
}

export function CenterForm({ center }: { center?: Row }) {
  const [s, action, pending] = useActionState(saveCenterAction, null);
  return (
    <form action={action} className="space-y-3">
      <Msg state={s} />
      {center?.id && <input type="hidden" name="id" value={String(center.id)} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          idPrefix={String(center?.id ?? "new") + "-"}
          state={s}
          saved={center?.name}
          name="name"
          label="Nombre de la sede"
          required
        />
        <Field
          idPrefix={String(center?.id ?? "new") + "-"}
          state={s}
          saved={center?.address}
          name="address"
          label="Dirección"
        />
        <Field
          state={s}
          saved={center?.daneCityCode}
          name="daneCityCode"
          label="Municipio (DANE, 5 dígitos)"
          inputMode="numeric"
        />
        <Field
          state={s}
          saved={center?.riskClass}
          name="riskClass"
          label="Clase de riesgo de la sede (opcional)"
          inputMode="numeric"
        />
        <Field
          state={s}
          saved={center?.workersCount ?? 0}
          name="workersCount"
          label="Trabajadores en la sede"
          inputMode="numeric"
        />
      </div>
      <Submit pending={pending}>{center?.id ? "Actualizar sede" : "Agregar sede"}</Submit>
    </form>
  );
}

export function RemoveCenter({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => confirm("¿Eliminar esta sede?") && start(() => removeCenterAction(id))}
    >
      Eliminar
    </Button>
  );
}

export function ResponsibleForm({ saved }: { saved: Row }) {
  const [s, action, pending] = useActionState(saveResponsibleAction, null);
  const v = (k: string) =>
    typeof s?.values?.[k] === "string" ? String(s?.values?.[k]) : String(saved[k] ?? "");
  return (
    <form action={action} className="space-y-3">
      <Msg state={s} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field state={s} saved={saved.fullName} name="fullName" label="Nombre completo" required />
        <div className="space-y-1">
          <Label htmlFor="idType">Tipo de documento</Label>
          <select id="idType" name="idType" className={sel} defaultValue={v("idType") || "13"}>
            <option value="13">Cédula de ciudadanía</option>
            <option value="22">Cédula de extranjería</option>
            <option value="41">Pasaporte</option>
            <option value="42">Documento extranjero</option>
          </select>
        </div>
        <Field
          state={s}
          saved={saved.idNumber}
          name="idNumber"
          label="Número de documento"
          inputMode="numeric"
          required
        />
        <Field state={s} saved={saved.email} name="email" label="Correo" type="email" required />
        <Field state={s} saved={saved.phone} name="phone" label="Teléfono" inputMode="tel" />
        <div className="space-y-1">
          <Label htmlFor="profile">Perfil</Label>
          <select
            id="profile"
            name="profile"
            className={sel}
            defaultValue={v("profile") || "profesional"}
          >
            <option value="profesional">Profesional en SST</option>
            <option value="tecnologo">Tecnólogo en SST</option>
            <option value="tecnico">Técnico en SST</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <Field
          state={s}
          saved={saved.licenseNumber}
          name="licenseNumber"
          label="Licencia en SST (número)"
        />
        <Field
          state={s}
          saved={saved.licenseIssuer}
          name="licenseIssuer"
          label="Entidad que expidió la licencia"
        />
        <Field
          state={s}
          saved={saved.licenseValidUntil}
          name="licenseValidUntil"
          label="Vigencia de la licencia"
          type="date"
        />
        <Field
          state={s}
          saved={saved.course50hDate}
          name="course50hDate"
          label="Curso de 50 horas: fecha del certificado"
          type="date"
        />
        <Field
          state={s}
          saved={saved.course50hEntity}
          name="course50hEntity"
          label="Curso de 50 horas: entidad"
        />
        <Field
          state={s}
          saved={saved.refresher20hDate}
          name="refresher20hDate"
          label="Última actualización de 20 horas"
          type="date"
        />
      </div>
      <Submit pending={pending}>Guardar responsable</Submit>
    </form>
  );
}

export function BrandForm({ saved }: { saved: Row }) {
  const [s, action, pending] = useActionState(saveBrandAction, null);
  return (
    <form action={action} className="space-y-3">
      <Msg state={s} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          state={s}
          saved={saved.primary}
          name="primary"
          label="Color primario"
          type="color"
          className="p-1"
        />
        <Field
          state={s}
          saved={saved.secondary}
          name="secondary"
          label="Color secundario"
          type="color"
          className="p-1"
        />
        <Field
          state={s}
          saved={saved.accent}
          name="accent"
          label="Color de acento"
          type="color"
          className="p-1"
        />
      </div>
      <p className="text-muted-foreground text-sm">
        Se valida el contraste (WCAG AA). La carga del logotipo se habilitará al configurar el
        almacenamiento de archivos.
      </p>
      <Submit pending={pending}>Guardar colores</Submit>
    </form>
  );
}

export function CompleteButton({ disabled }: { disabled: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<FormState>(null);
  const router = useRouter();
  return (
    <div className="space-y-2">
      {msg && !msg.ok && <Alert variant="destructive">{msg.message}</Alert>}
      <Button
        disabled={disabled || pending}
        onClick={() =>
          start(async () => {
            const r = await completeOnboardingAction();
            setMsg(r);
            if (r?.ok) router.push("/");
          })
        }
      >
        {pending ? "Finalizando…" : "Finalizar onboarding"}
      </Button>
    </div>
  );
}

export function ResolveAlertButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => start(() => resolveAlertAction(id))}
    >
      Entendido
    </Button>
  );
}
