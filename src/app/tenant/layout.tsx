import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BasePathProvider } from "@/components/layout/base-path";
import { currentTenant } from "@/core/auth/session";
import { brandStyleSheet } from "@/core/branding/contrast";
import { currentBase } from "@/core/tenancy/base-path";

// La PWA se instala por empresa: el manifest lleva su ruta base (`/acme/api/manifest`) para fijar `start_url` y `scope`.
export async function generateMetadata(): Promise<Metadata> {
  return { manifest: `${await currentBase()}/api/manifest` };
}

/** Marca blanca: inyecta las variables CSS de la empresa (validadas como #rrggbb) en tiempo de ejecución. */
export default async function TenantLayout({ children }: LayoutProps<"/tenant">) {
  const tenant = await currentTenant();
  if (!tenant) notFound();
  return (
    <BasePathProvider base={await currentBase()}>
      <style dangerouslySetInnerHTML={{ __html: brandStyleSheet(tenant.brand) }} />
      {children}
    </BasePathProvider>
  );
}
