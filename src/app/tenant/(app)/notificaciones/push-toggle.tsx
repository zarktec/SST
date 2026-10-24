"use client";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { subscribePushAction, unsubscribePushAction } from "./actions";

const b64ToUint8 = (s: string) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const raw = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

/** Activa o desactiva las notificaciones push (PWA) en este dispositivo. */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<"checking" | "unsupported" | "off" | "on" | "denied">(
    "checking",
  );
  const [msg, setMsg] = useState("");
  useEffect(() => {
    (async () => {
      if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window))
        return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      setState((await reg?.pushManager.getSubscription()) ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [publicKey]);

  async function enable() {
    try {
      const reg =
        (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.ready);
      if ((await Notification.requestPermission()) !== "granted") return setState("denied");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64ToUint8(publicKey),
      });
      const r = await subscribePushAction(JSON.stringify(sub.toJSON()));
      setMsg(r?.message ?? "");
      setState(r?.ok ? "on" : "off");
    } catch {
      setMsg("No se pudo activar en este dispositivo.");
    }
  }
  async function disable() {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await unsubscribePushAction(sub.endpoint);
      await sub.unsubscribe();
    }
    setMsg("Notificaciones desactivadas en este dispositivo.");
    setState("off");
  }
  if (state === "checking") return null;
  if (state === "unsupported")
    return (
      <p className="text-muted-foreground text-xs">
        Las notificaciones push no están disponibles en este dispositivo o no están configuradas.
      </p>
    );
  if (state === "denied")
    return (
      <Alert variant="warning">
        Bloqueaste las notificaciones en el navegador; actívalas desde su configuración.
      </Alert>
    );
  return (
    <div className="flex flex-wrap items-center gap-3">
      {state === "on" ? (
        <Button size="sm" variant="outline" onClick={disable}>
          Desactivar notificaciones en este dispositivo
        </Button>
      ) : (
        <Button size="sm" onClick={enable}>
          Activar notificaciones en este dispositivo
        </Button>
      )}
      <span className="text-sm" aria-live="polite">
        {msg}
      </span>
    </div>
  );
}
