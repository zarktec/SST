import { and, eq, isNull } from "drizzle-orm";
import { schema, systemDb } from "@/core/db";
import { classifyHost, normalizeHost } from "./hosts";

export type ResolvedTenant = {
  tenantId: string;
  slug: string;
  tradeName: string;
  status: (typeof schema.tenant.$inferSelect)["status"];
  brand: {
    primary: string;
    secondary: string;
    accent: string;
    logoLightUrl: string | null;
    logoDarkUrl: string | null;
    faviconUrl: string | null;
  };
};

const TTL_MS = 30_000;
const cache = new Map<string, { at: number; value: ResolvedTenant | null }>();

export function invalidateTenantHostCache() {
  cache.clear();
}

/**
 * host → empresa. Subdominio: por slug. Dominio propio: solo si está en tenant_domain con estado
 * `verified`. Cualquier otro host → null (el proxy responde 404). Caché de 30 s por instancia;
 * TODO-INFRA: Edge Config/KV para invalidación entre instancias (Fase 1, con la API de dominios de Vercel).
 */
export async function resolveTenantByHost(rawHost: string): Promise<ResolvedTenant | null> {
  const host = normalizeHost(rawHost);
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const k = classifyHost(host);
  let tenantId: string | undefined;
  if (k.kind === "subdomain") {
    const [t] = await systemDb()
      .select({ id: schema.tenant.id })
      .from(schema.tenant)
      .where(and(eq(schema.tenant.slug, k.slug), isNull(schema.tenant.deletedAt)));
    tenantId = t?.id;
  } else if (k.kind === "custom") {
    const [d] = await systemDb()
      .select({ tenantId: schema.tenantDomain.tenantId })
      .from(schema.tenantDomain)
      .where(and(eq(schema.tenantDomain.host, host), eq(schema.tenantDomain.status, "verified")));
    tenantId = d?.tenantId;
  }

  let value: ResolvedTenant | null = null;
  if (tenantId) {
    const [t] = await systemDb().select().from(schema.tenant).where(eq(schema.tenant.id, tenantId));
    const [b] = await systemDb()
      .select()
      .from(schema.tenantBranding)
      .where(eq(schema.tenantBranding.tenantId, tenantId));
    if (t && !t.deletedAt) {
      value = {
        tenantId: t.id,
        slug: t.slug,
        tradeName: t.tradeName,
        status: t.status,
        brand: {
          primary: b?.primary ?? "#0f766e",
          secondary: b?.secondary ?? "#1e293b",
          accent: b?.accent ?? "#f59e0b",
          logoLightUrl: b?.logoLightUrl ?? null,
          logoDarkUrl: b?.logoDarkUrl ?? null,
          faviconUrl: b?.faviconUrl ?? null,
        },
      };
    }
  }
  cache.set(host, { at: Date.now(), value });
  return value;
}
