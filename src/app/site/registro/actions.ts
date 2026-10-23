"use server";
import { and, eq, gt, sql } from "drizzle-orm";
import { schema, systemDb, withPlatform } from "@/core/db";
import { getPlanByKey } from "@/modules/platform/plans/service";
import {
  TenantError,
  createTenantSchema,
  createTenantWithTrial,
} from "@/modules/platform/tenants/service";

export type SignupState = { ok: boolean; message: string; host?: string } | null;

/**
 * Registro self-service: crea la empresa con la prueba gratuita y envía una invitación de administrador al correo
 * (el acceso es por correo/enlace mágico, así que el correo queda verificado al entrar).
 */
export async function signupAction(_p: SignupState, f: FormData): Promise<SignupState> {
  if (String(f.get("website") ?? "")) return { ok: true, message: "Revisa tu correo." }; // honeypot
  const parsed = createTenantSchema.safeParse({
    slug: f.get("slug"),
    legalName: f.get("legalName"),
    tradeName: f.get("tradeName"),
    nit: String(f.get("nit") ?? "").trim() || undefined,
    owner: { email: f.get("email") },
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const owner = parsed.data.owner as { email: string };
  // Freno por correo: evita crear empresas en bucle con un mismo correo.
  const [{ n }] = await systemDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.invitation)
    .where(
      and(
        eq(schema.invitation.email, owner.email),
        gt(schema.invitation.createdAt, new Date(Date.now() - 3_600_000)),
      ),
    );
  if (n >= 2)
    return { ok: false, message: "Ya registraste empresas recientemente. Intenta más tarde." };
  try {
    const r = await createTenantWithTrial(parsed.data, "signup");
    const key = String(f.get("plan") ?? "");
    const plan = key ? await getPlanByKey(key) : null;
    if (plan && plan.active && !plan.isTrial && plan.visible) {
      const period = plan.prices.monthly?.active ? "monthly" : "annual";
      await withPlatform({ actorId: "signup", action: "signup.plan", tenantId: r.tenantId }, (tx) =>
        tx
          .update(schema.subscription)
          .set({ scheduledPlanId: plan.id, scheduledPeriod: period })
          .where(eq(schema.subscription.tenantId, r.tenantId)),
      );
    }
    return {
      ok: true,
      message: "¡Listo! Te enviamos un correo para entrar a tu empresa.",
      host: r.host,
    };
  } catch (e) {
    if (e instanceof TenantError) return { ok: false, message: e.message };
    console.error("[signup]", e);
    return { ok: false, message: "No pudimos crear la empresa. Intenta de nuevo." };
  }
}
