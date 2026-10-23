/**
 * Clasificación de hosts. Dominio raíz: NEXT_PUBLIC_ROOT_DOMAIN (p. ej. sst.zark.pro).
 *   sst.zark.pro            → marketing (landing, precios, registro)
 *   admin.sst.zark.pro      → panel SUPER ADMIN
 *   auth.sst.zark.pro       → dominio central de autenticación (OAuth)
 *   {slug}.sst.zark.pro     → empresa (subdominio)
 *   cualquier otro host     → posible dominio propio de una empresa (se resuelve en BD)
 */
export type HostKind =
  | { kind: "marketing" }
  | { kind: "admin" }
  | { kind: "auth" }
  | { kind: "subdomain"; slug: string }
  | { kind: "custom"; host: string };

export const RESERVED_SLUGS = new Set([
  "www",
  "admin",
  "auth",
  "api",
  "app",
  "mail",
  "status",
  "docs",
  "soporte",
  "support",
  "billing",
  "static",
  "cdn",
]);

export function rootDomain(): string {
  return (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000").toLowerCase();
}

export function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, "");
}

export function classifyHost(rawHost: string, root = rootDomain()): HostKind {
  const host = normalizeHost(rawHost);
  if (host === root || host === `www.${root}`) return { kind: "marketing" };
  if (host === `admin.${root}`) return { kind: "admin" };
  if (host === `auth.${root}`) return { kind: "auth" };
  if (host.endsWith(`.${root}`)) {
    const slug = host.slice(0, -(root.length + 1));
    // Un solo nivel: a.b.root no es un tenant válido.
    if (/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) && !RESERVED_SLUGS.has(slug)) {
      return { kind: "subdomain", slug };
    }
    return { kind: "marketing" };
  }
  return { kind: "custom", host };
}

/** http en desarrollo local, https en cualquier otro caso. */
export function protocolFor(host: string): "http" | "https" {
  return /^((.*\.)?localhost|127\.0\.0\.1|(.*\.)?lvh\.me)(:\d+)?$/.test(normalizeHost(host))
    ? "http"
    : "https";
}

export function originFor(host: string): string {
  return `${protocolFor(host)}://${normalizeHost(host)}`;
}

export function authHost(root = rootDomain()): string {
  return `auth.${root}`;
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])$/.test(slug) && !RESERVED_SLUGS.has(slug);
}
