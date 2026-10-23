import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { schema, systemDb } from "@/core/db";
import { normalizeHost } from "@/core/tenancy/hosts";

/**
 * Traspaso de sesión entre el dominio central de autenticación (auth.) y el dominio de la empresa.
 * El token es de un solo uso y muy corto (60 s), se guarda hasheado y queda ligado al host destino,
 * a la empresa y al usuario. Las cookies de sesión son `host-only`: nunca se comparten entre dominios.
 */

export const HANDOFF_TTL_MS = 60_000;

const idFor = (token: string) => `handoff:${createHash("sha256").update(token).digest("hex")}`;

export type HandoffPayload = {
  userId: string;
  tenantId: string;
  host: string;
  next: string;
  loginMethod: string | null;
};

/** Solo rutas relativas de la propia app: evita open redirect (//evil.com, /\evil.com, https://…). */
export function sanitizeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (/[\r\n]/.test(next)) return "/";
  return next;
}

export async function issueHandoff(
  p: Omit<HandoffPayload, "next"> & { next?: string },
  now = new Date(),
) {
  const token = randomBytes(32).toString("base64url");
  const payload: HandoffPayload = { ...p, host: normalizeHost(p.host), next: sanitizeNext(p.next) };
  await systemDb()
    .insert(schema.verification)
    .values({
      id: randomBytes(16).toString("hex"),
      identifier: idFor(token),
      value: JSON.stringify(payload),
      expiresAt: new Date(now.getTime() + HANDOFF_TTL_MS),
    });
  return token;
}

/** Consume el token (atómico: DELETE … RETURNING). Devuelve null si no existe, venció o es para otro host. */
export async function consumeHandoff(
  token: string,
  host: string,
  now = new Date(),
): Promise<HandoffPayload | null> {
  const [row] = await systemDb()
    .delete(schema.verification)
    .where(
      and(eq(schema.verification.identifier, idFor(token)), gt(schema.verification.expiresAt, now)),
    )
    .returning();
  if (!row) return null;
  const payload = JSON.parse(row.value) as HandoffPayload;
  if (payload.host !== normalizeHost(host)) return null;
  return { ...payload, next: sanitizeNext(payload.next) };
}
