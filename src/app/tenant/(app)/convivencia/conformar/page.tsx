import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { ConformForm } from "../../comites/forms";
import { listCenters, listWorkers } from "@/modules/workers/service";

export const metadata = { title: "Conformar Comité de Convivencia" };

export default async function ConformCclPage() {
  const ctx = await requirePermission("committees", "create");
  const [people, centers] = await Promise.all([
    listWorkers(ctx.tenant.tenantId, { status: "active" }),
    listCenters(ctx.tenant.tenantId),
  ]);
  return (
    <div className="space-y-4">
      <Link href="/convivencia" className="text-primary text-sm underline">
        ← Convivencia
      </Link>
      <h1 className="text-2xl font-bold">Conformar el Comité de Convivencia Laboral</h1>
      <p className="text-muted-foreground text-sm">
        No pueden integrarlo quienes hayan sido denunciados o víctimas de acoso laboral en el último
        año. Cada integrante debe tener su correo registrado en su ficha para acceder a las quejas.
      </p>
      <Card>
        <CardTitle>Integrantes</CardTitle>
        <div className="mt-3">
          <ConformForm
            kind="ccl"
            people={people
              .filter((p) => p.kind !== "contractor")
              .map((p) => ({ id: p.id, name: p.fullName }))}
            centers={centers}
          />
        </div>
      </Card>
    </div>
  );
}
