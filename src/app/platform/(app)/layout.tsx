import { AppShell } from "@/components/layout/app-shell";
import type { NavItem } from "@/components/layout/nav-config";
import { Alert } from "@/components/ui/alert";
import { requirePlatformStaff } from "@/core/auth/session";
import { schema, systemDb } from "@/core/db";
import { PLATFORM_ARTICLES } from "@/modules/help/content";
import { routeMap } from "@/modules/help/types";

const NAV: NavItem[] = [
  { href: "/", label: "Resumen", icon: "Home" },
  { href: "/empresas", label: "Empresas", icon: "Building2" },
  { href: "/planes", label: "Planes", icon: "CreditCard" },
  { href: "/pagos", label: "Pagos y facturas", icon: "Receipt" },
  { href: "/integrations", label: "Integraciones", icon: "Plug" },
  { href: "/catalogos", label: "Catálogos", icon: "ScrollText" },
  { href: "/ayuda", label: "Ayuda", icon: "BookOpen" },
];

export default async function PlatformLayout({ children }: LayoutProps<"/platform">) {
  const staff = await requirePlatformStaff();
  // Advertencia visible mientras alguna integración activa opere en sandbox.
  const integrations = await systemDb().select().from(schema.integration);
  const sandbox = integrations
    .filter((i) => i.enabled && i.activeEnv === "sandbox")
    .map((i) => i.key);
  return (
    <AppShell
      brandName="SST · Admin"
      groups={[{ label: "", items: NAV }]}
      quick={NAV.slice(0, 4)}
      helpMap={routeMap(PLATFORM_ARTICLES)}
      userLabel={`${staff.user.email} · ${staff.role}`}
      banner={
        sandbox.length ? (
          <Alert variant="warning" className="rounded-none border-x-0">
            La plataforma opera en <strong>SANDBOX</strong> para: {sandbox.join(", ")}. Los cobros y
            facturas no son reales.
          </Alert>
        ) : undefined
      }
    >
      {children}
    </AppShell>
  );
}
