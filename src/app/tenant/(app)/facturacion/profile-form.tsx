"use client";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { DANE_STATES, FISCAL_RESPONSIBILITIES, ID_TYPES } from "@/modules/billing/billing-profile";
import { saveProfileAction } from "./actions";

type P = Partial<Record<string, string | boolean | string[] | null>>;
const sel = "border-input bg-background min-h-11 w-full rounded-md border px-3 text-base";

export function ProfileForm({ profile }: { profile: P | null }) {
  const [state, action, pending] = useActionState(saveProfileAction, null);
  const src: P | null = state?.values ?? profile;
  const v = (k: string) => String(src?.[k] ?? "");
  const err = (k: string) =>
    state?.fieldErrors?.[k] ? (
      <p className="text-destructive text-sm" role="alert">
        {state.fieldErrors[k]}
      </p>
    ) : null;
  const text = (name: string, label: string, extra: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={v(name)} {...extra} />
      {err(name)}
    </div>
  );
  const frs = (src?.fiscalResponsibilities as string[] | undefined) ?? [];
  return (
    <form action={action} className="space-y-3">
      {state && <Alert variant={state.ok ? "success" : "destructive"}>{state.message}</Alert>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="personType">Tipo de persona</Label>
          <select
            id="personType"
            name="personType"
            className={sel}
            defaultValue={v("personType") || "Company"}
          >
            <option value="Company">Persona jurídica</option>
            <option value="Person">Persona natural</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="idType">Tipo de documento</Label>
          <select id="idType" name="idType" className={sel} defaultValue={v("idType") || "31"}>
            {ID_TYPES.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
          {err("idType")}
        </div>
        {text("identification", "Número de documento (sin puntos ni DV)", {
          inputMode: "numeric",
          required: true,
        })}
        {text("checkDigit", "Dígito de verificación (NIT)", { inputMode: "numeric", maxLength: 1 })}
        {text("legalName", "Razón social o nombre completo", { required: true })}
        {text("address", "Dirección", { required: true })}
        <div className="space-y-1">
          <Label htmlFor="stateCode">Departamento (código DANE)</Label>
          <select
            id="stateCode"
            name="stateCode"
            className={sel}
            defaultValue={v("stateCode") || "11"}
          >
            {DANE_STATES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {err("stateCode")}
        </div>
        {text("cityCode", "Municipio (código DANE de 5 dígitos)", {
          inputMode: "numeric",
          required: true,
          placeholder: "11001",
        })}
        {text("postalCode", "Código postal (opcional)", { inputMode: "numeric" })}
        {text("phone", "Teléfono", { inputMode: "tel", required: true })}
        {text("invoiceEmail", "Correo para recibir la factura electrónica", {
          type: "email",
          required: true,
        })}
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Responsabilidades fiscales</legend>
        {FISCAL_RESPONSIBILITIES.map((f) => (
          <label key={f.code} className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="fiscalResponsibilities"
              value={f.code}
              defaultChecked={frs.includes(f.code)}
              className="size-5"
            />
            {f.code} · {f.label}
          </label>
        ))}
        {err("fiscalResponsibilities")}
      </fieldset>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="vatResponsible"
          defaultChecked={src?.vatResponsible === true}
          className="size-5"
        />
        Responsable de IVA
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Guardando…" : "Guardar datos de facturación"}
      </Button>
    </form>
  );
}
