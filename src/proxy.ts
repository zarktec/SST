import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, newNonce } from "@/core/security/csp";
import { classifyHost, normalizeHost, protocolFor, tenantSlugFromPath } from "@/core/tenancy/hosts";
import {
  resolveTenantByHost,
  resolveTenantBySlug,
  type ResolvedTenant,
} from "@/core/tenancy/resolve";

/**
 * Enrutamiento por host y ruta (Next 16: `proxy.ts` reemplaza a `middleware.ts` y corre en Node).
 *   marketing → /site/*            admin → /platform/*            auth → /central/*
 *   marketing + /{slug}/…  → /tenant/…   (empresa por ruta, base `/{slug}`)
 *   dominio propio         → /tenant/…   (empresa en la raíz, base "")
 * Las carpetas internas no son accesibles directamente: cada host solo llega a su propia área.
 * Las rutas `/api/*` y `/offline` son comunes; bajo `/{slug}/api/*` llevan además la empresa.
 */
const INTERNAL = ["/site", "/platform", "/central", "/tenant"];
// Encabezados que solo el proxy puede fijar: se borran de la petición entrante.
const TENANT_HEADERS = ["x-tenant-id", "x-tenant-slug", "x-tenant-base"];

const isShared = (p: string) => p === "/api" || p.startsWith("/api/") || p === "/offline";

export async function proxy(req: NextRequest) {
  const host = req.headers.get("host") ?? "";

  // CSP con nonce por solicitud: el nonce viaja en los encabezados de la solicitud (el layout raíz lo lee para sus scripts en
  // línea y Next lo aplica a los suyos) y la política en la respuesta.
  const nonce = newNonce();
  const csp = buildCsp({
    nonce,
    dev: process.env.NODE_ENV === "development",
    https: protocolFor(host) === "https",
  });
  const headers = new Headers(req.headers);
  for (const h of TENANT_HEADERS) headers.delete(h);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);

  const { pathname } = req.nextUrl;
  const secure = <T extends NextResponse>(res: T): T => {
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  if (INTERNAL.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return secure(new NextResponse("Not found", { status: 404 }));
  }

  const rewriteTo = (path: string, tenant?: { t: ResolvedTenant; base: string }) => {
    if (tenant) {
      headers.set("x-tenant-id", tenant.t.tenantId);
      headers.set("x-tenant-slug", tenant.t.slug);
      headers.set("x-tenant-base", tenant.base);
    }
    const url = req.nextUrl.clone();
    url.pathname = path;
    return secure(NextResponse.rewrite(url, { request: { headers } }));
  };
  const pass = () => secure(NextResponse.next({ request: { headers } }));
  const area = (prefix: string, p: string) => `${prefix}${p === "/" ? "" : p}`;

  const h = classifyHost(host);
  switch (h.kind) {
    case "unknown":
      return secure(new NextResponse("Not found", { status: 404 }));

    case "admin":
      return isShared(pathname) ? pass() : rewriteTo(area("/platform", pathname));

    case "auth":
      return isShared(pathname) ? pass() : rewriteTo(area("/central", pathname));

    case "custom": {
      const t = await resolveTenantByHost(normalizeHost(host));
      if (!t)
        return secure(
          new NextResponse("Esta empresa no existe o su dominio no está verificado.", {
            status: 404,
          }),
        );
      const tenant = { t, base: "" };
      return isShared(pathname)
        ? rewriteTo(pathname, tenant)
        : rewriteTo(area("/tenant", pathname), tenant);
    }

    case "marketing": {
      // sst.zark.pro/{slug}/…: si el primer segmento es una empresa, el resto es su app.
      const slug = tenantSlugFromPath(pathname);
      const t = slug ? await resolveTenantBySlug(slug) : null;
      if (t && slug) {
        const base = `/${slug}`;
        const rest = pathname.slice(base.length) || "/";
        const tenant = { t, base };
        return isShared(rest) ? rewriteTo(rest, tenant) : rewriteTo(area("/tenant", rest), tenant);
      }
      // Segmento sin empresa: sigue a marketing, que responde 404 si la ruta no existe.
      return isShared(pathname) ? pass() : rewriteTo(area("/site", pathname));
    }
  }
}

export const config = {
  // Excluye internals de Next y archivos estáticos (con extensión: sw.js, íconos, etc.).
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
