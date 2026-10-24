import { and, eq } from "drizzle-orm";
import { schema, systemDb } from "@/core/db";
import { originFor, rootDomain, withBase } from "./hosts";

/**
 * Dónde vive una empresa: su dominio propio verificado (panel en la raíz) o, si no tiene,
 * el dominio raíz bajo `/{slug}`.
 */
export async function tenantEntry(tenantId: string): Promise<{ host: string; base: string }> {
  const [t] = await systemDb()
    .select({ slug: schema.tenant.slug })
    .from(schema.tenant)
    .where(eq(schema.tenant.id, tenantId));
  const custom = await systemDb()
    .select({ host: schema.tenantDomain.host })
    .from(schema.tenantDomain)
    .where(
      and(
        eq(schema.tenantDomain.tenantId, tenantId),
        eq(schema.tenantDomain.status, "verified"),
        eq(schema.tenantDomain.kind, "custom"),
      ),
    );
  if (custom[0]) return { host: custom[0].host, base: "" };
  return { host: rootDomain(), base: t ? `/${t.slug}` : "" };
}

/** URL absoluta de una ruta de la app de la empresa (para correos, QR y enlaces públicos). */
export async function tenantUrl(tenantId: string, path = "/"): Promise<string> {
  const { host, base } = await tenantEntry(tenantId);
  return `${originFor(host)}${withBase(base, path)}`;
}
