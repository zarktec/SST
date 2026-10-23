import { EnableTwoFactor } from "@/components/auth/enable-two-factor";
import { AuthCard } from "@/components/layout/auth-card";
import { Alert } from "@/components/ui/alert";
import { requirePlatformStaff } from "@/core/auth/session";

export const metadata = { title: "Activar 2FA" };

export default async function Page() {
  await requirePlatformStaff({ skip2fa: true });
  return (
    <AuthCard title="Activa la verificación en dos pasos" brandName="SST · Admin">
      <Alert variant="warning" className="mb-4">
        El 2FA es obligatorio para el equipo de plataforma.
      </Alert>
      <EnableTwoFactor />
    </AuthCard>
  );
}
