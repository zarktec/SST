"use server";
import { headers } from "next/headers";
import { currentTenant } from "@/core/auth/session";
import { tooManyAttempts } from "@/core/security/rate-limit";
import { CommitteeError, castVote } from "@/modules/committees/service";

export async function castVoteAction(
  token: string,
  candidateIds: string[],
): Promise<{ ok: boolean; message: string }> {
  const tenant = await currentTenant();
  if (!tenant) return { ok: false, message: "Empresa no encontrada." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  if (await tooManyAttempts(`vote:${ip}:${token.slice(0, 16)}`, 10, 600))
    return { ok: false, message: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." };
  try {
    await castVote(tenant.tenantId, token, candidateIds);
    return { ok: true, message: "Tu voto quedó registrado. ¡Gracias por participar!" };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof CommitteeError ? e.message : "No se pudo registrar el voto. Intenta de nuevo.",
    };
  }
}
