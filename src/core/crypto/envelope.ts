import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Cifrado de sobre (envelope): cada valor usa una DEK aleatoria AES-256-GCM; la DEK se envuelve
 * con la llave maestra (ENCRYPTION_MASTER_KEY). Rotar la maestra = re-envolver DEKs, no re-cifrar datos.
 *
 * Formato serializado (texto): v1.<keyVersion>.<iv>.<tag>.<ct>.<wrappedDek>  (base64url)
 * `aad` (datos autenticados adicionales) ata el cifrado a su contexto: un valor copiado a otra
 * fila/campo no descifra.
 */

const ALGO = "aes-256-gcm";
const FORMAT = "v1";

function b64u(buf: Buffer): string {
  return buf.toString("base64url");
}
function fromB64u(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

export function getMasterKey(version = 1): Buffer {
  const name = version === 1 ? "ENCRYPTION_MASTER_KEY" : `ENCRYPTION_MASTER_KEY_V${version}`;
  const raw = process.env[name];
  if (!raw) throw new Error(`Falta la variable ${name}`);
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error(`${name} debe ser de 32 bytes en base64`);
  return key;
}

export function currentKeyVersion(): number {
  const v = Number(process.env.ENCRYPTION_KEY_VERSION ?? "1");
  return Number.isInteger(v) && v >= 1 ? v : 1;
}

function seal(key: Buffer, plaintext: Buffer, aad: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  cipher.setAAD(aad);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { iv, tag: cipher.getAuthTag(), ct };
}

function open(key: Buffer, iv: Buffer, tag: Buffer, ct: Buffer, aad: Buffer): Buffer {
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

export function encrypt(plaintext: string, aad: string): string {
  const kv = currentKeyVersion();
  const dek = randomBytes(32);
  const data = seal(dek, Buffer.from(plaintext, "utf8"), Buffer.from(aad));
  const wrapped = seal(getMasterKey(kv), dek, Buffer.from(`dek:${aad}`));
  const wrappedDek = Buffer.concat([wrapped.iv, wrapped.tag, wrapped.ct]);
  return [FORMAT, kv, b64u(data.iv), b64u(data.tag), b64u(data.ct), b64u(wrappedDek)].join(".");
}

export function decrypt(payload: string, aad: string): string {
  const [format, kvRaw, iv, tag, ct, wrappedDekRaw] = payload.split(".");
  if (format !== FORMAT || !wrappedDekRaw) throw new Error("Formato de cifrado no soportado");
  const wd = fromB64u(wrappedDekRaw);
  const dek = open(
    getMasterKey(Number(kvRaw)),
    wd.subarray(0, 12),
    wd.subarray(12, 28),
    wd.subarray(28),
    Buffer.from(`dek:${aad}`),
  );
  return open(dek, fromB64u(iv), fromB64u(tag), fromB64u(ct), Buffer.from(aad)).toString("utf8");
}

/** Re-envuelve la DEK con la llave maestra vigente sin tocar el ciphertext (rotación de maestra). */
export function rewrap(payload: string, aad: string): string {
  const [format, kvRaw, iv, tag, ct, wrappedDekRaw] = payload.split(".");
  if (format !== FORMAT || !wrappedDekRaw) throw new Error("Formato de cifrado no soportado");
  const wd = fromB64u(wrappedDekRaw);
  const dek = open(
    getMasterKey(Number(kvRaw)),
    wd.subarray(0, 12),
    wd.subarray(12, 28),
    wd.subarray(28),
    Buffer.from(`dek:${aad}`),
  );
  const kv = currentKeyVersion();
  const w = seal(getMasterKey(kv), dek, Buffer.from(`dek:${aad}`));
  return [FORMAT, kv, iv, tag, ct, b64u(Buffer.concat([w.iv, w.tag, w.ct]))].join(".");
}

/**
 * Blind index: HMAC determinista para buscar por igualdad (p. ej. cédula) sin descifrar.
 * `context` separa espacios (un mismo valor produce índices distintos por tenant/campo).
 */
export function blindIndex(value: string, context: string): string {
  const raw = process.env.BLIND_INDEX_KEY ?? process.env.ENCRYPTION_MASTER_KEY;
  if (!raw) throw new Error("Falta BLIND_INDEX_KEY");
  const key = Buffer.from(raw, "base64");
  return createHmac("sha256", key)
    .update(`${context}:${value.normalize("NFKC").trim().toLowerCase()}`)
    .digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Enmascara un secreto para mostrarlo: `prv_prod_abcdef3f9a` → `prv_prod_••••••3f9a`. */
export function maskSecret(value: string): string {
  if (value.length <= 8) return "••••••••";
  const prefixMatch = value.match(/^([a-z]+_(?:[a-z]+_)?)/i);
  const prefix = prefixMatch ? prefixMatch[1] : "";
  return `${prefix}••••••${value.slice(-4)}`;
}
