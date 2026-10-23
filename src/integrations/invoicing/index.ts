import "server-only";
import type { InvoicingProvider } from "./types";
import { SiigoProvider } from "./siigo/client";

export function getInvoicingProvider(): InvoicingProvider {
  return SiigoProvider.fromRegistry();
}
export type { InvoicingProvider } from "./types";
