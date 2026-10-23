"use client";
import { useEffect } from "react";

/** Registra el service worker (PWA). Solo en producción para no interferir con el HMR. */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);
  return null;
}
