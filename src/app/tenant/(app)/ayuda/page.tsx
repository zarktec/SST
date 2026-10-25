import { HelpIndex } from "@/components/help/help-pages";
import { requireTenantMember } from "@/core/auth/session";
import { withTenant } from "@/core/db";
import { can, loadPermissions } from "@/core/rbac/can";
import { TENANT_ARTICLES, TENANT_GROUPS } from "@/modules/help/content";

export const metadata = { title: "Centro de ayuda" };

export default async function HelpPage({ searchParams }: PageProps<"/tenant/ayuda">) {
  const ctx = await requireTenantMember();
  const perms = await withTenant({ tenantId: ctx.tenant.tenantId }, (tx) =>
    loadPermissions(tx, ctx.roleId),
  );
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : undefined;
  return (
    <HelpIndex
      articles={TENANT_ARTICLES}
      groups={TENANT_GROUPS}
      q={q || undefined}
      intro="Guías paso a paso de cada módulo. Si estás empezando, abre «Primeros pasos»."
      canOpen={(a) => !a.module || can(perms, a.module as never, "view")}
    />
  );
}
