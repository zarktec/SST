import { notFound } from "next/navigation";
import { HelpArticle } from "@/components/help/help-pages";
import { requireTenantMember } from "@/core/auth/session";
import { withTenant } from "@/core/db";
import { can, loadPermissions } from "@/core/rbac/can";
import { TENANT_ARTICLES, TENANT_GROUPS } from "@/modules/help/content";

export async function generateMetadata({ params }: PageProps<"/tenant/ayuda/[slug]">) {
  const { slug } = await params;
  return { title: TENANT_ARTICLES.find((a) => a.slug === slug)?.title ?? "Ayuda" };
}

export default async function HelpArticlePage({ params }: PageProps<"/tenant/ayuda/[slug]">) {
  const { slug } = await params;
  const article = TENANT_ARTICLES.find((a) => a.slug === slug);
  if (!article) notFound();
  const ctx = await requireTenantMember();
  const perms = await withTenant({ tenantId: ctx.tenant.tenantId }, (tx) =>
    loadPermissions(tx, ctx.roleId),
  );
  // El orden de «anterior/siguiente» sigue el del índice.
  const ordered = TENANT_GROUPS.flatMap((g) => TENANT_ARTICLES.filter((a) => a.group === g));
  return (
    <HelpArticle
      article={article}
      all={ordered}
      canOpen={!article.module || can(perms, article.module as never, "view")}
    />
  );
}
