import { Suspense } from "react";
import { TwoFactorForm } from "@/components/auth/two-factor-form";
import { AuthCard } from "@/components/layout/auth-card";

export default function Page() {
  return (
    <AuthCard title="Verificación en dos pasos" brandName="SST · Admin">
      <Suspense>
        <TwoFactorForm />
      </Suspense>
    </AuthCard>
  );
}
