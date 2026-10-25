import { NextResponse } from "next/server";
import { classifyHost } from "@/core/tenancy/hosts";
import { currentBase } from "@/core/tenancy/base-path";
import { currentTenant } from "@/core/auth/session";

/** Manifest de la PWA: cada empresa (por ruta `/{slug}` o dominio propio) se instala con su nombre, color y alcance. */
export async function GET(req: Request) {
  const host = req.headers.get("host") ?? "";
  const kind = classifyHost(host).kind;
  const tenant = await currentTenant();
  const base = await currentBase();
  const name = tenant?.tradeName ?? (kind === "admin" ? "SST Admin" : "SST");
  return NextResponse.json(
    {
      name,
      short_name: name.slice(0, 12),
      description: "Sistema de Gestión de Seguridad y Salud en el Trabajo",
      start_url: base || "/",
      scope: `${base}/`,
      display: "standalone",
      orientation: "portrait",
      lang: "es-CO",
      background_color: "#ffffff",
      theme_color: tenant?.brand.primary ?? "#001953",
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
