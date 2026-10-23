import { auco } from "../auco/definition";
import { google, microsoft } from "../oauth/definitions";
import { siigo } from "../siigo/definition";
import { wompi } from "../wompi/definition";
import type { IntegrationDef, IntegrationKey } from "./types";

export const DEFINITIONS: Record<IntegrationKey, IntegrationDef> = {
  wompi,
  siigo,
  auco,
  google,
  microsoft,
};

export function getDefinition(key: string): IntegrationDef {
  const def = (DEFINITIONS as Record<string, IntegrationDef>)[key];
  if (!def) throw new Error(`Integración desconocida: ${key}`);
  return def;
}
