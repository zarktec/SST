import { NextResponse } from "next/server";
import { classifyHost } from "@/core/tenancy/hosts";
import { resolveTenantByHost } from "@/core/tenancy/resolve";

/** Manifest de la PWA por host: cada empresa se instala con su nombre y color. */
export async function GET(req: Request) {
  const host = req.headers.get("host") ?? "";
  const kind = classifyHost(host).kind;
  const tenant = kind === "subdomain" || kind === "custom" ? await resolveTenantByHost(host) : null;
  const name = tenant?.tradeName ?? (kind === "admin" ? "SST Admin" : "SST");
  return NextResponse.json(
    {
      name,
      short_name: name.slice(0, 12),
      description: "Sistema de Gestión de Seguridad y Salud en el Trabajo",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      lang: "es-CO",
      background_color: "#ffffff",
      theme_color: tenant?.brand.primary ?? "#0f766e",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        {
          src: "/icons/maskable-512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    {
      headers: {
        "content-type": "application/manifest+json",
        "cache-control": "public, max-age=300",
      },
    },
  );
}
