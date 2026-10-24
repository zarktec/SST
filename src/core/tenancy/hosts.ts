/**
 * Clasificación de hosts y rutas. Dominio raíz: NEXT_PUBLIC_ROOT_DOMAIN (p. ej. sst.zark.pro).
 *   sst.zark.pro            → marketing (landing, precios, registro) y empresas por ruta: sst.zark.pro/{slug}
 *   admin.sst.zark.pro      → panel SUPER ADMIN
 *   auth.sst.zark.pro       → dominio central de autenticación (OAuth y traspaso a dominios propios)
 *   cualquier otro host     → posible dominio propio de una empresa (se resuelve en BD); el panel va en la raíz
 *   otro *.sst.zark.pro     → desconocido (404): las empresas ya no usan subdominio
 */
export type HostKind =
  | { kind: "marketing" }
  | { kind: "admin" }
  | { kind: "auth" }
  | { kind: "unknown" }
  | { kind: "custom"; host: string };

/**
 * Slugs no asignables a una empresa: son el primer segmento de la ruta en el dominio raíz y no
 * pueden chocar con las rutas de marketing, de la app ni de los archivos públicos.
 * Toda carpeta nueva en `src/app/site` o ruta pública de nivel superior debe agregarse aquí
 * (`hosts.test.ts` lo verifica para `src/app/site`).
 */
export const RESERVED_SLUGS = new Set([
  // Hosts reservados
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
  // Rutas de marketing y de la app en el dominio raíz
  "precios",
  "registro",
  "login",
  "logout",
  "offline",
  "icons",
  "sw",
  "manifest",
  "favicon",
  "robots",
  "sitemap",
  "terminos",
  "privacidad",
  "ayuda",
  "contacto",
  // Carpetas internas del enrutador
  "site",
  "platform",
  "central",
  "tenant",
  "_next",
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
  if (host.endsWith(`.${root}`)) return { kind: "unknown" };
  return { kind: "custom", host };
}

const SLUG_SHAPE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Primer segmento de la ruta del dominio raíz si podría ser el slug de una empresa
 * (forma válida y no reservado); null en otro caso. No comprueba que la empresa exista.
 */
export function tenantSlugFromPath(pathname: string): string | null {
  const seg = pathname.split("/")[1]?.toLowerCase() ?? "";
  return SLUG_SHAPE.test(seg) && !RESERVED_SLUGS.has(seg) ? seg : null;
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

/** Antepone la ruta base de la empresa (`/acme` en el dominio raíz, "" en dominio propio) a una ruta de la app. */
export function withBase(base: string, path: string): string {
  if (!base || !path.startsWith("/") || path.startsWith("//")) return path;
  return path === "/" ? base : `${base}${path}`;
}

/** Inverso de `withBase`: la ruta de la app sin el prefijo de la empresa. */
export function stripBase(base: string, pathname: string): string {
  if (!base) return pathname;
  if (pathname === base) return "/";
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname;
}
