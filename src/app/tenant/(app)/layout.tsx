import { AppShell } from "@/components/layout/app-shell";
import { MODULE_GROUPS, type NavGroup } from "@/components/layout/nav-config";
import { Alert } from "@/components/ui/alert";
import { requireTenantMember } from "@/core/auth/session";
import { withTenant } from "@/core/db";
import { can, loadPermissions, permissionList } from "@/core/rbac/can";
import { tp } from "@/core/tenancy/base-path";
import { unreadCount } from "@/modules/notifications/service";

export default async function TenantAppLayout({ children }: LayoutProps<"/tenant">) {
  const ctx = await requireTenantMember();
  const perms = await withTenant({ tenantId: ctx.tenant.tenantId }, (tx) =>
    loadPermissions(tx, ctx.roleId),
  );
  // Cada persona solo ve los módulos a los que su rol da acceso.
  const groups: NavGroup[] = [
    { label: "", items: [{ href: "/", label: "Inicio", icon: "Home" }] },
    ...MODULE_GROUPS.map((g) => ({
      label: g.label,
      items: g.items
        .filter((i) => !i.module || can(perms, i.module as never, "view"))
        .map(({ href, label, icon }) => ({ href, label, icon })),
    })).filter((g) => g.items.length > 0),
  ];
  const has = (href: string) => groups.some((g) => g.items.some((i) => i.href === href));
  const quick = [
    { href: "/", label: "Inicio", icon: "Home" as const },
    ...[
      { href: "/reportes", label: "Reportar", icon: "ShieldAlert" as const },
      { href: "/acciones", label: "Acciones", icon: "Target" as const },
      { href: "/personas", label: "Personas", icon: "Users" as const },
      { href: "/portal", label: "Mi portal", icon: "UserRound" as const },
    ].filter((i) => has(i.href)),
  ].slice(0, 4);
  const unread = await unreadCount(ctx.tenant.tenantId, ctx.user.id, permissionList(perms)).catch(
    () => 0,
  );
  return (
    <AppShell
      brandName={ctx.tenant.tradeName}
      logoUrl={ctx.tenant.brand.logoLightUrl}
      groups={groups}
      quick={quick}
      userLabel={ctx.user.email}
      searchAction={await tp("/buscar")}
      alertsHref="/notificaciones"
      unread={unread}
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
