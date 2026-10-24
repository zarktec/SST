"use client";
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ModalContext = createContext<{ close: () => void } | null>(null);

/** Cierra el modal que contiene al componente (no-op fuera de uno). Los formularios lo usan al guardar con éxito. */
export function useModalClose(): (() => void) | null {
  return useContext(ModalContext)?.close ?? null;
}

type Props = {
  title: string;
  /** Texto del botón que abre el modal. */
  trigger: React.ReactNode;
  description?: string;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  triggerClassName?: string;
  size?: "md" | "lg";
  children: React.ReactNode;
};

/**
 * Modal accesible sobre `<dialog>` nativo (foco atrapado, Esc, `aria-modal`). En móvil se abre como hoja inferior.
 * El contenido solo se monta mientras está abierto: cada apertura empieza limpia y no hay ids duplicados en la página.
 */
export function FormModal({
  title,
  trigger,
  description,
  triggerVariant = "outline",
  triggerSize = "sm",
  triggerClassName,
  size = "md",
  children,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <Button
        variant={triggerVariant}
        size={triggerSize}
        className={triggerClassName}
        onClick={() => {
          // El diálogo se muestra antes de montar el contenido: los campos que miden su tamaño (la firma) lo ven ya visible.
          ref.current?.showModal();
          setOpen(true);
        }}
        aria-haspopup="dialog"
      >
        {trigger}
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={open ? "modal-title" : undefined}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === ref.current && setOpen(false)}
        className={cn(
          "bg-card text-card-foreground m-auto w-full rounded-xl border p-0 shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-[1px]",
          size === "lg" ? "max-w-3xl" : "max-w-xl",
          "max-sm:mb-0 max-sm:max-h-[92dvh] max-sm:max-w-none max-sm:rounded-b-none",
        )}
      >
        {open && (
          <ModalContext.Provider value={{ close }}>
            <div className="flex max-h-[85dvh] flex-col sm:max-h-[88dvh]">
              <div className="flex items-start justify-between gap-3 border-b p-4 sm:px-6">
                <div>
                  <h2 id="modal-title" className="text-lg font-semibold">
                    {title}
                  </h2>
                  {description && (
                    <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={close}
                  aria-label="Cerrar"
                  className="-mr-2 shrink-0"
                >
                  <X className="size-5" aria-hidden />
                </Button>
              </div>
              <div className="overflow-y-auto p-4 sm:p-6">{children}</div>
            </div>
          </ModalContext.Provider>
        )}
      </dialog>
    </>
  );
}
