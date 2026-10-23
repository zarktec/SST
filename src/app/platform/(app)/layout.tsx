import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { requirePlatformStaff } from "@/core/auth/session";

const NAV: NavItem[] = [
  { href: "/", label: "Resumen", icon: "Home" },
  { href: "/empresas", label: "Empresas", icon: "Building2" },
  { href: "/planes", label: "Planes", icon: "CreditCard" },
  { href: "/integrations", label: "Integraciones", icon: "Plug" },
  { href: "/auditoria", label: "Auditoría", icon: "ScrollText" },
];

export default async function PlatformLayout({ children }: LayoutProps<"/platform">) {
  const staff = await requirePlatformStaff();
  return (
    <AppShell brandName="SST · Admin" nav={NAV} userLabel={`${staff.user.email} · ${staff.role}`}>
      {children}
    </AppShell>
  );
}
