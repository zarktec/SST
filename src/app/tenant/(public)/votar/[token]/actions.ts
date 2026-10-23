"use server";
import { currentHost } from "@/core/auth/session";
import { resolveTenantByHost } from "@/core/tenancy/resolve";
import { CommitteeError, castVote } from "@/modules/committees/service";

export async function castVoteAction(
  token: string,
  candidateIds: string[],
): Promise<{ ok: boolean; message: string }> {
  const tenant = await resolveTenantByHost(await currentHost());
  if (!tenant) return { ok: false, message: "Empresa no encontrada." };
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
