import { notFound } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { AuthCard } from "@/components/layout/auth-card";
import { activeProviders } from "@/core/auth/config";
import { currentHost, currentTenant } from "@/core/auth/session";
import { currentBase, tp } from "@/core/tenancy/base-path";
import { authHost, originFor } from "@/core/tenancy/hosts";

export const metadata = { title: "Ingresar" };

export default async function TenantLogin({ searchParams }: PageProps<"/tenant/login">) {
  const host = await currentHost();
  const tenant = await currentTenant();
  if (!tenant) notFound();
  const sp = await searchParams;
  const providers = await activeProviders(host);
  const base = await currentBase();
  // El login social se hace en el dominio central y vuelve con un token de un solo uso.
  const socialBase = `${originFor(authHost())}/api/central/social?host=${encodeURIComponent(host)}&slug=${encodeURIComponent(tenant.slug)}&next=${encodeURIComponent(base || "/")}`;
  return (
    <AuthCard
      title="Ingresar"
      description={`Accede a ${tenant.tradeName}`}
      brandName={tenant.tradeName}
      logoUrl={tenant.brand.logoLightUrl}
    >
      <LoginForm
        callbackURL={await tp("/")}
        providers={providers}
        socialBase={socialBase}
        initialError={typeof sp.error === "string" ? sp.error : undefined}
      />
    </AuthCard>
  );
}
