import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";

/** Marco del sitio público (inicio, precios, registro, ingreso): logotipo de ZarK y accesos principales. */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-secondary text-secondary-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" aria-label="ZarK, inicio">
            <BrandLogo variant="white" height={32} />
          </Link>
          <nav aria-label="Sitio" className="flex items-center gap-1 text-sm font-medium">
            <Link
              href="/precios"
              className="inline-flex min-h-11 items-center rounded-md px-3 hover:bg-white/10"
            >
              Precios
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-md px-3 hover:bg-white/10"
            >
              Ingresar
            </Link>
            <Link
              href="/registro"
              className="bg-accent text-accent-foreground ml-1 inline-flex min-h-11 items-center rounded-md px-4 hover:opacity-90"
            >
              Prueba gratis
            </Link>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="text-muted-foreground border-t p-4 text-center text-xs">
        © ZarK · Seguridad y Salud en el Trabajo
      </footer>
    </div>
  );
}
