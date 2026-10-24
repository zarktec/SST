import { createHash } from "node:crypto";
import { strToU8, zipSync } from "fflate";

export type ZipEntry = { path: string; data: Uint8Array | string };
export const sha256 = (d: Uint8Array | string) => createHash("sha256").update(d).digest("hex");

/** ZIP con las entradas dadas (rutas con "/" crean carpetas). Devuelve también la huella SHA-256 de cada archivo. */
export function buildZip(entries: ZipEntry[]): {
  zip: Uint8Array;
  manifest: { path: string; sha256: string; bytes: number }[];
} {
  const files: Record<string, Uint8Array> = {};
  const manifest: { path: string; sha256: string; bytes: number }[] = [];
  for (const e of entries) {
    const data = typeof e.data === "string" ? strToU8(e.data) : e.data;
    files[e.path] = data;
    manifest.push({ path: e.path, sha256: sha256(data), bytes: data.byteLength });
  }
  return { zip: zipSync(files), manifest };
}
