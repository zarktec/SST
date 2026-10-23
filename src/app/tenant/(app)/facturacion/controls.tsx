"use client";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  cancelAction,
  payNowAction,
  removeSourceAction,
  selectPlanAction,
  setBackupSourceAction,
  setDefaultSourceAction,
  undoCancelAction,
  type FormState,
} from "./actions";

/** Botón que ejecuta una acción de servidor y muestra su resultado. */
export function ActionButton({
  run,
  children,
  variant = "outline",
  confirm,
}: {
  run: () => Promise<FormState | void>;
  children: React.ReactNode;
  variant?: "outline" | "default";
  confirm?: string;
}) {
  const [msg, setMsg] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={variant}
        size="sm"
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          start(async () => setMsg((await run()) ?? null));
        }}
      >
        {pending ? "Procesando…" : children}
      </Button>
      {msg && <Alert variant={msg.ok ? "success" : "destructive"}>{msg.message}</Alert>}
    </div>
  );
}

export const PayNowButton = ({ sourceId }: { sourceId?: string }) => (
  <ActionButton
    variant="default"
    run={() => payNowAction(sourceId)}
    confirm="¿Pagar ahora con el método seleccionado?"
  >
    Pagar ahora
  </ActionButton>
);
export const ChoosePlanButton = ({
  planId,
  period,
  label,
}: {
  planId: string;
  period: "monthly" | "annual";
  label: string;
}) => <ActionButton run={() => selectPlanAction(planId, period)}>{label}</ActionButton>;
export const CancelButton = () => (
  <ActionButton run={cancelAction} confirm="¿Seguro que quieres cancelar tu suscripción?">
    Cancelar suscripción
  </ActionButton>
);
export const UndoCancelButton = () => (
  <ActionButton run={undoCancelAction}>Mantener mi suscripción</ActionButton>
);
export const DefaultSourceButton = ({ id }: { id: string }) => (
  <ActionButton run={() => setDefaultSourceAction(id)}>Predeterminado</ActionButton>
);
export const BackupSourceButton = ({ id }: { id: string | null }) => (
  <ActionButton run={() => setBackupSourceAction(id)}>
    {id ? "Usar de respaldo" : "Quitar respaldo"}
  </ActionButton>
);
export const RemoveSourceButton = ({ id }: { id: string }) => (
  <ActionButton run={() => removeSourceAction(id)} confirm="¿Eliminar este método de pago?">
    Eliminar
  </ActionButton>
);
