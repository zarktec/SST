import Link from "next/link";
import { AuthCard } from "@/components/layout/auth-card";
import { Alert } from "@/components/ui/alert";

const REASONS: Record<string, string> = {
  unknown_host: "Esa empresa no existe o su dominio aún no está verificado.",
  not_invited:
    "Tu usuario no ha sido invitado a esa empresa. Pide una invitación a su administrador.",
  sso_required: "Esa empresa exige ingresar con Google o Microsoft.",
  tenant_cancelled: "La suscripción de esa empresa está cancelada.",
  membership_disabled: "Tu acceso a esa empresa fue deshabilitado.",
  membership_expired: "Tu acceso temporal a esa empresa venció.",
  tenant_not_found: "Esa empresa no existe.",
};

export default async function Denied({ searchParams }: PageProps<"/central/login/denied">) {
  const { reason } = await searchParams;
  return (
    <AuthCard title="No pudimos darte acceso" brandName="SST">
      <Alert variant="warning">
        {REASONS[String(reason)] ?? "No tienes acceso a esa empresa."}
      </Alert>
      <Link href="/select-tenant" className="text-brand-text mt-4 inline-block text-sm underline">
        Elegir otra empresa
      </Link>
    </AuthCard>
  );
}
