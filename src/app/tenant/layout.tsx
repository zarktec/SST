import { notFound } from "next/navigation";
import { currentHost } from "@/core/auth/session";
import { brandStyleSheet } from "@/core/branding/contrast";
import { resolveTenantByHost } from "@/core/tenancy/resolve";

/** Marca blanca: inyecta las variables CSS de la empresa (validadas como #rrggbb) en tiempo de ejecución. */
export default async function TenantLayout({ children }: LayoutProps<"/tenant">) {
  const tenant = await resolveTenantByHost(await currentHost());
  if (!tenant) notFound();
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: brandStyleSheet(tenant.brand) }} />
      {children}
    </>
  );
}
