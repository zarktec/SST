import "server-only";
import { redirect } from "next/navigation";
import { requireTenantMember } from "@/core/auth/session";

/** Facturación solo para el administrador de la empresa (datos fiscales y medios de pago). */
export async function requireBillingAdmin() {
  const ctx = await requireTenantMember();
  if (ctx.roleKey !== "ADMIN_EMPRESA") redirect("/");
  return ctx;
}
