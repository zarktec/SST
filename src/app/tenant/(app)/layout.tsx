import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { Alert } from "@/components/ui/alert";
import { requireTenantMember } from "@/core/auth/session";

// Navegación de la empresa. Se amplía por fase (autoevaluación, trabajadores, reportes, …).
const NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: "Home" },
  { href: "/estandares", label: "Estándares", icon: "ClipboardCheck" },
  { href: "/reportes", label: "Reportar", icon: "ShieldAlert" },
  { href: "/personas", label: "Personas", icon: "Users" },
  { href: "/indicadores", label: "Indicadores", icon: "BarChart3" },
];

export default async function TenantAppLayout({ children }: LayoutProps<"/tenant">) {
  const ctx = await requireTenantMember();
  return (
    <AppShell
      brandName={ctx.tenant.tradeName}
      logoUrl={ctx.tenant.brand.logoLightUrl}
      nav={
        ctx.roleKey === "ADMIN_EMPRESA"
          ? [...NAV, { href: "/facturacion", label: "Facturación", icon: "CreditCard" }]
          : NAV
      }
      userLabel={ctx.user.email}
      banner={
        ctx.readOnly ? (
          <Alert variant="warning" className="rounded-none border-x-0">
            Tu cuenta está suspendida: solo puedes consultar. Regulariza el pago para volver a
            editar.
          </Alert>
        ) : undefined
      }
    >
      {children}
    </AppShell>
  );
}
