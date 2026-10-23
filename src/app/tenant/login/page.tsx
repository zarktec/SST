import { notFound } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { AuthCard } from "@/components/layout/auth-card";
import { activeProviders } from "@/core/auth/config";
import { currentHost } from "@/core/auth/session";
import { authHost } from "@/core/tenancy/hosts";
import { originFor } from "@/core/tenancy/hosts";
import { resolveTenantByHost } from "@/core/tenancy/resolve";

export const metadata = { title: "Ingresar" };

export default async function TenantLogin({ searchParams }: PageProps<"/tenant/login">) {
  const host = await currentHost();
  const tenant = await resolveTenantByHost(host);
  if (!tenant) notFound();
  const sp = await searchParams;
  const providers = await activeProviders(host);
  // El login social se hace en el dominio central y vuelve con un token de un solo uso.
  const socialBase = `${originFor(authHost())}/api/central/social?host=${encodeURIComponent(host)}&next=%2F`;
  return (
    <AuthCard
      title="Ingresar"
      description={`Accede a ${tenant.tradeName}`}
      brandName={tenant.tradeName}
      logoUrl={tenant.brand.logoLightUrl}
    >
      <LoginForm
        callbackURL="/"
        providers={providers}
        socialBase={socialBase}
        initialError={typeof sp.error === "string" ? sp.error : undefined}
      />
    </AuthCard>
  );
}
