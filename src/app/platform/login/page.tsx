import { LoginForm } from "@/components/auth/login-form";
import { AuthCard } from "@/components/layout/auth-card";

export const metadata = { title: "Ingresar · Plataforma" };

// El SUPER ADMIN siempre entra con correo + contraseña + 2FA: no depende de Google/Microsoft.
export default async function PlatformLogin({ searchParams }: PageProps<"/platform/login">) {
  const sp = await searchParams;
  return (
    <AuthCard
      title="Panel de plataforma"
      description="Acceso del equipo de plataforma."
      brandName="SST · Admin"
    >
      <LoginForm
        callbackURL="/"
        providers={{ google: false, microsoft: false }}
        twoFactorPath="/login/2fa"
        initialError={typeof sp.error === "string" ? sp.error : undefined}
      />
    </AuthCard>
  );
}
