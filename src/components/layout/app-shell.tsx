"use client";
import {
  BarChart3,
  Building2,
  ClipboardCheck,
  CreditCard,
  Home,
  Plug,
  Receipt,
  ScrollText,
  ShieldAlert,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";

// Los íconos se pasan por nombre: los componentes no son serializables de Server a Client Components.
const ICONS = {
  Home,
  ClipboardCheck,
  ShieldAlert,
  Users,
  BarChart3,
  Building2,
  CreditCard,
  Plug,
  Receipt,
  ScrollText,
};
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

/**
 * Layout mobile-first: barra de navegación inferior en móvil (objetivos de 44 px+, hasta 5 ítems)
 * y barra lateral en escritorio. `usePathname` devuelve la ruta visible (sin el prefijo interno del proxy).
 */
function Icon({ name }: { name: keyof typeof ICONS }) {
  const C = ICONS[name];
  return <C className="size-5" aria-hidden />;
}

export function AppShell({
  brandName,
  logoUrl,
  nav,
  userLabel,
  children,
  banner,
}: {
  brandName: string;
  logoUrl?: string | null;
  nav: NavItem[];
  userLabel?: string;
  children: React.ReactNode;
  banner?: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      <aside className="bg-card hidden border-r md:flex md:flex-col">
        <div className="flex items-center gap-3 p-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-8 rounded" />
          ) : (
            <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded font-bold">
              {brandName.charAt(0)}
            </span>
          )}
          <span className="truncate font-semibold">{brandName}</span>
        </div>
        <nav aria-label="Principal" className="flex-1 space-y-1 p-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium",
                isActive(item.href) ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-between border-t p-3">
          <span className="text-muted-foreground truncate text-xs">{userLabel}</span>
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col pb-16 md:pb-0">
        <header className="bg-background/90 sticky top-0 z-10 flex items-center justify-between border-b px-4 py-2 backdrop-blur md:hidden">
          <span className="truncate font-semibold">{brandName}</span>
          <ThemeToggle />
        </header>
        {banner}
        <main className="mx-auto w-full max-w-5xl flex-1 p-4 sm:p-6">{children}</main>
      </div>

      <nav
        aria-label="Principal"
        className="bg-card safe-bottom fixed inset-x-0 bottom-0 z-20 grid border-t md:hidden"
        style={{ gridTemplateColumns: `repeat(${Math.min(nav.length, 5)}, minmax(0, 1fr))` }}
      >
        {nav.slice(0, 5).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              isActive(item.href) ? "text-brand-text" : "text-muted-foreground",
            )}
          >
            <Icon name={item.icon} />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
