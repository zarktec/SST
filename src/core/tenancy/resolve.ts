import { ZARK_BRAND } from "@/core/branding/contrast";
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

async function cached(
  key: string,
  find: () => Promise<string | undefined>,
): Promise<ResolvedTenant | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const tenantId = await find();
  const value = tenantId ? await loadTenant(tenantId) : null;
  cache.set(key, { at: Date.now(), value });
  return value;
}

async function loadTenant(tenantId: string): Promise<ResolvedTenant | null> {
  const [t] = await systemDb().select().from(schema.tenant).where(eq(schema.tenant.id, tenantId));
  if (!t || t.deletedAt) return null;
  const [b] = await systemDb()
    .select()
    .from(schema.tenantBranding)
    .where(eq(schema.tenantBranding.tenantId, tenantId));
  return {
    tenantId: t.id,
    slug: t.slug,
    tradeName: t.tradeName,
    status: t.status,
    brand: {
      primary: b?.primary ?? ZARK_BRAND.primary,
      secondary: b?.secondary ?? ZARK_BRAND.secondary,
      accent: b?.accent ?? ZARK_BRAND.accent,
      logoLightUrl: b?.logoLightUrl ?? null,
      logoDarkUrl: b?.logoDarkUrl ?? null,
      faviconUrl: b?.faviconUrl ?? null,
    },
  };
}

/**
 * Empresa por slug (ruta `/{slug}` del dominio raíz). Caché de 30 s por instancia;
 * TODO-INFRA: Edge Config/KV para invalidación entre instancias (Fase 1, con la API de dominios de Vercel).
 */
export function resolveTenantBySlug(rawSlug: string): Promise<ResolvedTenant | null> {
  const slug = rawSlug.trim().toLowerCase();
  return cached(`slug:${slug}`, async () => {
    const [t] = await systemDb()
      .select({ id: schema.tenant.id })
      .from(schema.tenant)
      .where(and(eq(schema.tenant.slug, slug), isNull(schema.tenant.deletedAt)));
    return t?.id;
  });
}

/**
 * Empresa por dominio propio: solo si está en tenant_domain con estado `verified`.
 * Cualquier otro host → null (el proxy responde 404).
 */
export function resolveTenantByHost(rawHost: string): Promise<ResolvedTenant | null> {
  const host = normalizeHost(rawHost);
  if (classifyHost(host).kind !== "custom") return Promise.resolve(null);
  return cached(`host:${host}`, async () => {
    const [d] = await systemDb()
      .select({ tenantId: schema.tenantDomain.tenantId })
      .from(schema.tenantDomain)
      .where(and(eq(schema.tenantDomain.host, host), eq(schema.tenantDomain.status, "verified")));
    return d?.tenantId;
  });
}

/** Empresa por id (el proxy ya la resolvió por ruta o dominio y la pasa en `x-tenant-id`). */
export function resolveTenantById(tenantId: string): Promise<ResolvedTenant | null> {
  return cached(`id:${tenantId}`, async () => tenantId);
}
