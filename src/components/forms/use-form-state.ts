"use client";
import { useActionState as useReactActionState, useEffect } from "react";
import { useModalClose } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import type { FormState } from "@/lib/form-state";

/**
 * `useActionState` para formularios con `FormState`: dentro de un modal, al guardar con éxito muestra un aviso y lo cierra. Misma firma que el de React.
 */
export function useActionState(
  action: (prev: FormState, data: FormData) => Promise<FormState>,
  initial: FormState = null,
) {
  const result = useReactActionState(action, initial);
  const close = useModalClose();
  const state = result[0];
  useEffect(() => {
    // Fuera de un modal el formulario ya muestra su propio mensaje: solo dentro se avisa y se cierra.
    if (state?.ok && close) {
      toast(state.message);
      close();
    }
  }, [state, close]);
  return result;
}
