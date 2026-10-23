import { LoginForm } from "@/components/auth/login-form";
import { AuthCard } from "@/components/layout/auth-card";
import { activeProviders } from "@/core/auth/config";
import { sanitizeNext } from "@/core/auth/handoff";
import { currentHost } from "@/core/auth/session";

export const metadata = { title: "Ingresar" };

export default async function CentralLogin({ searchParams }: PageProps<"/central/login">) {
  const sp = await searchParams;
  const host = typeof sp.host === "string" ? sp.host : "";
  const next = sanitizeNext(typeof sp.next === "string" ? sp.next : "/");
  const callbackURL = host
    ? `/api/auth/handoff/issue?host=${encodeURIComponent(host)}&next=${encodeURIComponent(next)}`
    : "/select-tenant";
  const providers = await activeProviders(await currentHost());
  const socialBase = `/api/central/social?host=${encodeURIComponent(host)}&next=${encodeURIComponent(next)}`;
  return (
    <AuthCard
      title="Ingresar"
      description="Accede con tu cuenta para elegir tu empresa."
      brandName="SST"
    >
      <LoginForm
        callbackURL={callbackURL}
        providers={providers}
        socialBase={socialBase}
        initialError={typeof sp.error === "string" ? sp.error : undefined}
      />
    </AuthCard>
  );
}
