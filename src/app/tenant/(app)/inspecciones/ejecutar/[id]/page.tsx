import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/core/auth/session";
import { listWorkCenters } from "@/modules/company/service";
import { getTemplate } from "@/modules/inspections/service";
import { Runner, SyncStatus } from "../../forms";

export const metadata = { title: "Realizar inspección" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function RunPage({ params }: PageProps<"/tenant/inspecciones/ejecutar/[id]">) {
  const ctx = await requirePermission("inspections", "create");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [t, centers] = await Promise.all([
    getTemplate(ctx.tenant.tenantId, id),
    listWorkCenters(ctx.tenant.tenantId),
  ]);
  if (!t || !t.active) notFound();
  return (
    <div className="space-y-4">
      <Link href="/inspecciones" className="text-primary text-sm underline">
        ← Inspecciones
      </Link>
      <h1 className="text-2xl font-bold">{t.name}</h1>
      <SyncStatus />
      <Runner
        template={{ id: t.id, name: t.name, items: t.items }}
        centers={centers.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
