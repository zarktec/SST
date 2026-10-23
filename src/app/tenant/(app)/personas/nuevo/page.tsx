import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { listCenters } from "@/modules/workers/service";
import { WorkerForm } from "../worker-form";

export const metadata = { title: "Registrar persona" };

export default async function NewWorker() {
  const ctx = await requirePermission("workers", "create");
  const centers = await listCenters(ctx.tenant.tenantId);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Registrar persona</h1>
      <Card>
        <CardTitle>Ficha</CardTitle>
        <div className="mt-3">
          <WorkerForm centers={centers} />
        </div>
      </Card>
    </div>
  );
}
