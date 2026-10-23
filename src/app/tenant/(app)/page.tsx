import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/core/auth/session";

export const metadata = { title: "Inicio" };

export default async function TenantHome() {
  const ctx = await requireTenantMember();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Hola, {ctx.user.name.split(" ")[0]}</h1>
      <Card>
        <CardTitle>Bienvenido a {ctx.tenant.tradeName}</CardTitle>
        <CardDescription className="mt-1">
          Rol: {ctx.roleKey ?? "personalizado"}. Los módulos del SG-SST se activan por fases a
          partir de la Fase 2.
        </CardDescription>
      </Card>
      {ctx.roleKey === "ADMIN_EMPRESA" && (
        <Link href="/facturacion" className="text-primary text-sm underline">
          Ir a Facturación (plan, pagos y facturas)
        </Link>
      )}
    </div>
  );
}
