import { A } from "@/components/ui/link";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/core/auth/session";
import { withTenant } from "@/core/db";
import { can, loadPermissions } from "@/core/rbac/can";
import { listCenters, listWorkers } from "@/modules/workers/service";
import { ComplaintForm } from "../forms";

export const metadata = { title: "Radicar queja de convivencia" };

export default async function SubmitPage() {
  const ctx = await requireTenantMember();
  const perms = await withTenant({ tenantId: ctx.tenant.tenantId }, (tx) =>
    loadPermissions(tx, ctx.roleId),
  );
  const [people, centers] = await Promise.all([
    // El directorio solo se ofrece a quien ya puede verlo; los demás pueden nombrar a la persona en el relato.
    can(perms, "workers", "view") ? listWorkers(ctx.tenant.tenantId, { status: "active" }) : [],
    listCenters(ctx.tenant.tenantId),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Queja ante el Comité de Convivencia Laboral</h1>
      <Card>
        <CardTitle>Radicar de forma confidencial</CardTitle>
        <CardDescription className="mt-1">
          Para situaciones de acoso laboral. Si se trata de acoso sexual o violencia de género usa
          el canal específico.
        </CardDescription>
        <div className="mt-3">
          <ComplaintForm
            people={people.map((p) => ({ id: p.id, name: p.fullName }))}
            centers={centers}
          />
        </div>
        <p className="mt-3 text-sm">
          <A href="/acoso-sexual/radicar" className="text-primary underline">
            Reportar acoso sexual o violencia de género
          </A>
        </p>
      </Card>
    </div>
  );
}
