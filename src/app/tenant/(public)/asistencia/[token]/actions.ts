"use server";
import { headers } from "next/headers";
import { currentTenant } from "@/core/auth/session";
import { tooManyAttempts } from "@/core/security/rate-limit";
import { TrainingError, signAttendanceByToken } from "@/modules/training/service";

export type AttendanceResult = {
  ok: boolean;
  message: string;
  passed?: boolean;
  score?: number | null;
};

export async function signAttendanceAction(input: {
  token: string;
  document: string;
  signature: string;
  answers: (number | null)[];
}): Promise<AttendanceResult> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const tenant = await currentTenant();
  if (!tenant) return { ok: false, message: "Empresa no encontrada." };
  // Freno compartido entre instancias: frena la adivinanza de documentos desde un mismo dispositivo (8 intentos / 10 min).
  if (await tooManyAttempts(`attendance:${ip}:${input.token}`, 8, 600))
    return {
      ok: false,
      message: "Demasiados intentos. Espera unos minutos o pide ayuda al capacitador.",
    };
  try {
    const r = await signAttendanceByToken(tenant.tenantId, input.token, {
      document: input.document,
      signature: input.signature,
      answers: input.answers,
      ip,
      userAgent: h.get("user-agent"),
    });
    return {
      ok: true,
      message: r.passed
        ? `Asistencia registrada, ${r.name}. ¡Gracias!`
        : `Asistencia registrada, pero no alcanzaste el puntaje mínimo (${r.score}).`,
      passed: r.passed,
      score: r.score,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof TrainingError ? e.message : "No se pudo registrar. Intenta de nuevo.",
    };
  }
}
