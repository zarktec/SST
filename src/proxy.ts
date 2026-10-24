import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, newNonce } from "@/core/security/csp";
import { classifyHost, protocolFor } from "@/core/tenancy/hosts";
import { resolveTenantByHost } from "@/core/tenancy/resolve";

/**
 * Enrutamiento por host (Next 16: `proxy.ts` reemplaza a `middleware.ts` y corre en Node).
 *   marketing → /site/*   admin → /platform/*   auth → /central/*   empresa → /tenant/*
 * Las carpetas internas no son accesibles directamente: cada host solo llega a su propia área.
 */
const INTERNAL = ["/site", "/platform", "/central", "/tenant"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") ?? "";

  if (INTERNAL.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return new NextResponse("Not found", { status: 404 });
  }

  // CSP con nonce por solicitud: el nonce viaja en los encabezados de la solicitud (el layout raíz lo lee para sus scripts en
  // línea y Next lo aplica a los suyos) y la política en la respuesta.
  const nonce = newNonce();
  const csp = buildCsp({
    nonce,
    dev: process.env.NODE_ENV === "development",
    https: protocolFor(host) === "https",
  });
  const headers = new Headers(req.headers);
  // Encabezados internos: nunca se confía en los que envía el cliente.
  headers.delete("x-tenant-id");
  headers.delete("x-tenant-slug");
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const secure = <T extends NextResponse>(res: T): T => {
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  // Rutas de API, assets de la PWA y offline son comunes a todos los hosts.
  if (pathname.startsWith("/api/") || pathname === "/offline")
    return secure(NextResponse.next({ request: { headers } }));

  const h = classifyHost(host);
  const prefix =
    h.kind === "marketing"
      ? "/site"
      : h.kind === "admin"
        ? "/platform"
        : h.kind === "auth"
          ? "/central"
          : "/tenant";

  const url = req.nextUrl.clone();
  url.pathname = `${prefix}${pathname === "/" ? "" : pathname}`;
  if (h.kind === "subdomain" || h.kind === "custom") {
    const tenant = await resolveTenantByHost(host);
    if (!tenant)
      return new NextResponse("Esta empresa no existe o su dominio no está verificado.", {
        status: 404,
      });
    headers.set("x-tenant-id", tenant.tenantId);
    headers.set("x-tenant-slug", tenant.slug);
  }
  return secure(NextResponse.rewrite(url, { request: { headers } }));
}

export const config = {
  // Excluye internals de Next y archivos estáticos (con extensión: sw.js, íconos, etc.).
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
