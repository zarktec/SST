import { NextResponse, type NextRequest } from "next/server";
import { classifyHost } from "@/core/tenancy/hosts";
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
  // Rutas de API, assets de la PWA y offline son comunes a todos los hosts.
  if (pathname.startsWith("/api/") || pathname === "/offline") return NextResponse.next();

  const h = classifyHost(host);
  const prefix =
    h.kind === "marketing"
      ? "/site"
      : h.kind === "admin"
        ? "/platform"
        : h.kind === "auth"
          ? "/central"
          : "/tenant";

  if (h.kind === "subdomain" || h.kind === "custom") {
    const tenant = await resolveTenantByHost(host);
    if (!tenant)
      return new NextResponse("Esta empresa no existe o su dominio no está verificado.", {
        status: 404,
      });
    const headers = new Headers(req.headers);
    headers.set("x-tenant-id", tenant.tenantId);
    headers.set("x-tenant-slug", tenant.slug);
    const url = req.nextUrl.clone();
    url.pathname = `${prefix}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url, { request: { headers } });
  }

  const url = req.nextUrl.clone();
  url.pathname = `${prefix}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Excluye internals de Next y archivos estáticos (con extensión: sw.js, íconos, etc.).
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
