import { createHash } from "node:crypto";

const MAX_SIGNATURE_BYTES = 200_000;
/** Firma táctil: PNG en data URL, tamaño acotado y con la cabecera PNG real (no se acepta cualquier cadena). */
export function isValidSignature(dataUrl: string): boolean {
  const m = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return false;
  const bytes = Buffer.from(m[1], "base64");
  return (
    bytes.length >= 100 &&
    bytes.length <= MAX_SIGNATURE_BYTES &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  );
}

/** Huella SHA-256 de la evidencia de una firma: concatena las partes (qué, quién, cuándo, desde dónde, con qué firma). */
export const hashEvidence = (parts: (string | null | undefined)[]): string =>
  createHash("sha256")
    .update(parts.map((p) => p ?? "").join("|"))
    .digest("hex");
