import "server-only";
import { headers } from "next/headers";
import { withBase } from "./hosts";

/**
 * Ruta base de la empresa de la petición actual: `/{slug}` en el dominio raíz, "" en dominio propio
 * y en las demás áreas. La fija el proxy en `x-tenant-base` (nunca el cliente: el proxy la borra).
 */
export async function currentBase(): Promise<string> {
  return (await headers()).get("x-tenant-base") ?? "";
}

/** Ruta de la app con la base de la empresa actual: `redirect(await tp("/login"))`. */
export async function tp(path: string): Promise<string> {
  return withBase(await currentBase(), path);
}
