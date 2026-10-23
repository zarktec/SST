import * as React from "react";
import type { FormState } from "@/lib/form-state";
import { Input, Label } from "./input";

type Props = React.ComponentProps<typeof Input> & {
  name: string;
  label: string;
  state: FormState;
  /** Valor guardado (se usa si el formulario no devolvió valores). */
  saved?: string | number | null;
  /** Prefijo del id cuando hay varios formularios con los mismos campos en la página. */
  idPrefix?: string;
};

/** Campo de texto con etiqueta, valor repoblado tras error y mensaje de validación accesible. */
export function Field({ name, label, state, saved, idPrefix = "", ...rest }: Props) {
  const id = `${idPrefix}${name}`;
  const v = state?.values?.[name];
  const err = state?.fieldErrors?.[name];
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        defaultValue={typeof v === "string" ? v : (saved ?? "")}
        aria-invalid={err ? true : undefined}
        aria-describedby={err ? `${id}-err` : undefined}
        {...rest}
      />
      {err && (
        <p id={`${id}-err`} className="text-destructive text-sm" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
