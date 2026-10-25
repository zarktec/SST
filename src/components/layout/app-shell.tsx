"use client";
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CalendarCheck,
  CalendarDays,
  Car,
  ClipboardCheck,
  Construction,
  CreditCard,
  FileBarChart,
  FileSearch,
  FileText,
  FlaskConical,
  FolderOpen,
  Globe,
  GraduationCap,
  HardHat,
  HeartHandshake,
  Home,
  ListChecks,
  Lock,
  Megaphone,
  Menu,
  Plug,
  Receipt,
  Scale,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Stethoscope,
  Target,
  TriangleAlert,
  UserCog,
  UserRound,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "@/components/ui/link";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Toaster } from "@/components/ui/toast";
import { stripBase } from "@/core/tenancy/hosts";
import { cn } from "@/lib/utils";
import { useBasePath } from "./base-path";
import type { IconName, NavGroup, NavItem } from "./nav-config";
import { ThemeToggle } from "./theme-toggle";

export type { NavItem, NavGroup } from "./nav-config";

// Los íconos se pasan por nombre: los componentes no son serializables de Server a Client Components.
const ICONS: Record<
  IconName,
  React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
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
  Scale,
  TriangleAlert,
  CalendarCheck,
  GraduationCap,
  HardHat,
  UsersRound,
  HeartHandshake,
  Stethoscope,
  Siren,
  Construction,
  FlaskConical,
  Car,
  Activity,
  FileSearch,
  FileText,
  Target,
  Megaphone,
  Bell,
  UserCog,
  Globe,
  FileBarChart,
  UserRound,
  ShieldCheck,
  ListChecks,
  FolderOpen,
  Lock,
  CalendarDays,
};

export function NavIcon({ name, className }: { name: IconName; className?: string }) {
  const C = ICONS[name];
  return <C className={cn("size-5", className)} aria-hidden />;
}

/**
 * Layout mobile-first. Escritorio: barra lateral agrupada por área + barra superior con búsqueda y alertas.
 * Móvil: barra inferior con los accesos principales y un menú que abre todos los módulos.
 * `usePathname` devuelve la ruta visible (con `/{slug}`: se quita con `stripBase`).
 */
export function AppShell({
  brandName,
  logoUrl,
  groups,
  quick,
  userLabel,
  searchAction,
  alertsHref,
  unread = 0,
  children,
  banner,
}: {
  brandName: string;
  logoUrl?: string | null;
  groups: NavGroup[];
  /** Accesos de la barra inferior en móvil (máximo 4; el quinto es "Menú"). */
  quick: NavItem[];
  userLabel?: string;
  /** Si se pasa, muestra el buscador global. */
  searchAction?: string;
  alertsHref?: string;
  unread?: number;
  children: React.ReactNode;
  banner?: React.ReactNode;
}) {
  const pathname = stripBase(useBasePath(), usePathname());
  const [menu, setMenu] = useState(false);
  const sheet = useRef<HTMLDialogElement>(null);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    const d = sheet.current;
    if (!d) return;
    if (menu && !d.open) d.showModal();
    if (!menu && d.open) d.close();
  }, [menu]);

  const bell = alertsHref && (
    <Link
      href={alertsHref}
      aria-label={unread > 0 ? `Alertas, ${unread} sin leer` : "Alertas"}
      className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-[var(--shell-hover)]"
    >
      <Bell className="size-5" aria-hidden />
      {unread > 0 && (
        <span
          aria-hidden
          className="absolute top-1.5 right-1.5 grid min-w-4 place-items-center rounded-full bg-[var(--nav-active-bg)] px-1 text-[10px] leading-4 font-bold text-[var(--nav-active-fg)]"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );

  // Logo de la empresa si lo cargó (sobre una pastilla blanca, pues suelen ser para fondo claro); si no, el de ZarK con el nombre.
  const brand = (
    <span className="flex min-w-0 items-center gap-3">
      {logoUrl ? (
        <>
          <span className="grid shrink-0 place-items-center rounded-md bg-white p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="" className="size-8 rounded object-contain" />
          </span>
          <span className="truncate font-semibold">{brandName}</span>
        </>
      ) : (
        <BrandLogo variant="white" height={34} />
      )}
    </span>
  );

  const navList = (onNavigate?: () => void) =>
    groups.map((g) => (
      <div key={g.label} className="space-y-1">
        {g.label && (
          <p className="px-3 pt-4 pb-1 text-[11px] font-semibold tracking-wider uppercase opacity-60">
            {g.label}
          </p>
        )}
        {g.items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-[var(--nav-active-bg)] text-[var(--nav-active-fg)] shadow-sm"
                : "opacity-90 hover:bg-[var(--shell-hover)] hover:opacity-100",
            )}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </Link>
        ))}
      </div>
    ));

  const search = searchAction && (
    <form action={searchAction} role="search" className="relative w-full max-w-md">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#4b5568]"
        aria-hidden
      />
      <input
        type="search"
        name="q"
        aria-label="Buscar"
        placeholder="Buscar personas, documentos, acciones…"
        className="dark:border-input dark:bg-background dark:text-foreground dark:placeholder:text-muted-foreground min-h-11 w-full rounded-lg border border-white/20 bg-white pr-3 pl-9 text-base text-[#111] placeholder:text-[#4b5568] md:text-sm"
      />
    </form>
  );

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[17rem_1fr]">
      <a
        href="#contenido"
        className="bg-background text-foreground focus:ring-ring sr-only z-50 rounded-md px-4 py-3 focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:ring-2"
      >
        Saltar al contenido
      </a>

      <aside className="hidden bg-[var(--shell-bg)] text-[var(--shell-fg)] md:sticky md:top-0 md:flex md:h-dvh md:flex-col dark:border-r dark:border-[var(--shell-line)]">
        <div className="border-b border-[var(--shell-line)] p-4">{brand}</div>
        <nav aria-label="Principal" className="sidebar-scroll flex-1 space-y-1 overflow-y-auto p-3">
          {navList()}
        </nav>
        <div className="flex items-center justify-between border-t border-[var(--shell-line)] p-3">
          <span className="truncate text-xs opacity-70">{userLabel}</span>
          <ThemeToggle className="hover:bg-[var(--shell-hover)]" />
        </div>
      </aside>

      <div className="bg-muted/40 flex min-h-dvh flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-10 flex items-center gap-2 bg-[var(--shell-bg)] px-4 py-2 text-[var(--shell-fg)] shadow-sm dark:border-b dark:border-[var(--shell-line)]">
          <span className="md:hidden">{brand}</span>
          <div className="hidden flex-1 md:block">{search}</div>
          <div className="ml-auto flex items-center gap-1">
            {bell}
            <ThemeToggle className="hover:bg-[var(--shell-hover)]" />
          </div>
        </header>
        {banner}
        <main
          id="contenido"
          tabIndex={-1}
          className="mx-auto w-full max-w-5xl flex-1 p-4 outline-none sm:p-6"
        >
          {children}
        </main>
      </div>

      <nav
        aria-label="Acceso rápido"
        className="bg-card safe-bottom fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t md:hidden"
      >
        {quick.slice(0, 4).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              isActive(item.href)
                ? "text-brand-text border-accent border-t-2 font-semibold"
                : "text-muted-foreground border-t-2 border-transparent",
            )}
          >
            <NavIcon name={item.icon} />
            {item.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMenu(true)}
          aria-haspopup="dialog"
          className="text-muted-foreground flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium"
        >
          <Menu className="size-5" aria-hidden />
          Menú
        </button>
      </nav>

      <dialog
        ref={sheet}
        aria-label="Menú"
        onClose={() => setMenu(false)}
        onClick={(e) => e.target === sheet.current && setMenu(false)}
        className="m-0 mt-auto h-[88dvh] max-h-[88dvh] w-full max-w-none rounded-t-2xl border-0 bg-[var(--shell-bg)] p-0 text-[var(--shell-fg)] shadow-2xl backdrop:bg-black/50 md:hidden"
      >
        {menu && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--shell-line)] p-3 pl-4">
              {brand}
              <button
                type="button"
                onClick={() => setMenu(false)}
                aria-label="Cerrar menú"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-[var(--shell-hover)]"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="sidebar-scroll space-y-3 overflow-y-auto p-3">
              {search}
              <nav aria-label="Todos los módulos" className="space-y-1">
                {navList(() => setMenu(false))}
              </nav>
              <p className="px-3 pb-4 text-xs opacity-70">{userLabel}</p>
            </div>
          </div>
        )}
      </dialog>
      <Toaster />
    </div>
  );
}
