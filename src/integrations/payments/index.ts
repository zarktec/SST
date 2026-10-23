import "server-only";
import type { PaymentProvider } from "./types";
import { WompiProvider } from "./wompi/client";

/** Pasarela activa (hoy solo Wompi). El resto de la plataforma solo conoce `PaymentProvider`. */
export function getPaymentProvider(): PaymentProvider {
  return WompiProvider.fromRegistry();
}

export type { PaymentProvider } from "./types";
