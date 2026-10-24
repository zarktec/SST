"use client";
import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

type Item = { id: number; message: string; kind: "success" | "error" };
const EVENT = "sst:toast";

/** Muestra un aviso breve desde cualquier componente de cliente (p. ej. al guardar un formulario en un modal). */
export function toast(message: string, kind: Item["kind"] = "success") {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, kind } }));
}

/** Contenedor de avisos: una sola instancia en el layout. `role=status` los anuncia sin quitar el foco. */
export function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const { message, kind } = (e as CustomEvent<Omit<Item, "id">>).detail;
      const id = ++n;
      setItems((cur) => [...cur.slice(-2), { id, message, kind }]);
      setTimeout(() => setItems((cur) => cur.filter((i) => i.id !== id)), 6000);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
    >
      {items.map((i) => (
        <div
          key={i.id}
          className="bg-foreground text-background pointer-events-auto flex max-w-md items-center gap-2 rounded-lg px-4 py-3 text-sm shadow-lg"
        >
          {i.kind === "success" ? (
            <CheckCircle2 className="size-5 shrink-0 text-emerald-400" aria-hidden />
          ) : (
            <XCircle className="size-5 shrink-0 text-red-400" aria-hidden />
          )}
          {i.message}
        </div>
      ))}
    </div>
  );
}
