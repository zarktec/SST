import { NextResponse } from "next/server";
import { activeProviders, getAuth } from "@/core/auth/config";
import { sanitizeNext } from "@/core/auth/handoff";
import { authHost, normalizeHost, rootDomain } from "@/core/tenancy/hosts";
import { resolveTenantByHost, resolveTenantBySlug } from "@/core/tenancy/resolve";

/**
 * Inicia el login social en el dominio central. Solo vive en auth.: el login con Google/Microsoft de
 * cualquier empresa (ruta del dominio raíz o dominio propio) pasa por aquí y vuelve con un token de un solo uso.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("host") ?? "";
  if (host !== authHost()) return new NextResponse("Not found", { status: 404 });

  const provider = url.searchParams.get("provider");
  const targetHost = url.searchParams.get("host") ?? "";
  const slug = url.searchParams.get("slug") ?? "";
  const next = sanitizeNext(url.searchParams.get("next"));
  const active = await activeProviders(host);
  if ((provider !== "google" && provider !== "microsoft") || !active[provider]) {
    return NextResponse.redirect(new URL("/login?error=provider_disabled", req.url));
  }
  let callbackURL = "/select-tenant";
  if (targetHost) {
    const bySlug = slug && normalizeHost(targetHost) === normalizeHost(rootDomain());
    const tenant = bySlug ? await resolveTenantBySlug(slug) : await resolveTenantByHost(targetHost);
    if (!tenant)
      return NextResponse.redirect(new URL("/login/denied?reason=unknown_host", req.url));
    callbackURL = `/api/auth/handoff/issue?host=${encodeURIComponent(targetHost)}${bySlug ? `&slug=${encodeURIComponent(slug)}` : ""}&next=${encodeURIComponent(next)}`;
  }
  const auth = await getAuth(host);
  const res = await auth.api.signInSocial({
    body: { provider, callbackURL },
    headers: req.headers,
    asResponse: true,
  });
  const data = (await res.json()) as { url?: string };
  if (!data.url) return NextResponse.redirect(new URL("/login?error=provider_error", req.url));
  const out = NextResponse.redirect(data.url);
  for (const c of res.headers.getSetCookie()) out.headers.append("set-cookie", c);
  return out;
}
