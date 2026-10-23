import { createHash, timingSafeEqual } from "node:crypto";

/** Firma de integridad de una transacción: SHA256(referencia + monto en centavos + moneda + secreto de integridad). */
export function integritySignature(
  reference: string,
  amountCents: bigint | number,
  currency: string,
  integritySecret: string,
): string {
  return createHash("sha256")
    .update(`${reference}${amountCents}${currency}${integritySecret}`)
    .digest("hex");
}

export type WompiEvent = {
  event: string;
  data: Record<string, unknown>;
  environment?: string;
  signature?: { properties?: string[]; checksum?: string };
  timestamp?: number;
  sent_at?: string;
};

const pick = (obj: unknown, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined),
      obj,
    );

/**
 * Checksum del evento: SHA256(valores de `signature.properties` (en ese orden, tomados de `data`) +
 * timestamp + secreto de eventos). Las propiedades se leen SIEMPRE del evento: pueden variar.
 */
export function eventChecksum(ev: WompiEvent, eventsSecret: string): string | null {
  const props = ev.signature?.properties;
  if (!Array.isArray(props) || props.length === 0 || typeof ev.timestamp !== "number") return null;
  const values = props.map((p) => pick(ev.data, p));
  if (values.some((v) => v === undefined || v === null || typeof v === "object")) return null;
  return createHash("sha256")
    .update(`${values.join("")}${ev.timestamp}${eventsSecret}`)
    .digest("hex");
}

/** Compara en tiempo constante, sin distinguir mayúsculas (Wompi envía el hash en mayúsculas). */
export function checksumsMatch(a: string, b: string): boolean {
  const x = Buffer.from(a.toLowerCase());
  const y = Buffer.from(b.toLowerCase());
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * ¿El evento es auténtico? Exige que el checksum del cuerpo coincida con el calculado, y que el del
 * encabezado `X-Event-Checksum` (si viene) coincida también.
 */
export function verifyWompiEvent(
  ev: WompiEvent,
  eventsSecret: string,
  headerChecksum?: string | null,
): boolean {
  if (!eventsSecret) return false;
  const expected = eventChecksum(ev, eventsSecret);
  const given = ev.signature?.checksum;
  if (!expected || !given || !checksumsMatch(expected, given)) return false;
  if (headerChecksum && !checksumsMatch(expected, headerChecksum)) return false;
  return true;
}
