import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { isActive, previousPeriod } from "@/modules/workers/rules";
import { getWorker, listCenters, workerSsChecks } from "@/modules/workers/service";
import { RetireForm, SsCheckForm, WorkerForm } from "../worker-form";
import { todayYmd } from "@/lib/dates";
import { FormModal } from "@/components/ui/modal";

export const metadata = { title: "Ficha de persona" };

export default async function WorkerPage({ params }: PageProps<"/tenant/personas/[id]">) {
  const ctx = await requirePermission("workers", "view");
  const { id } = await params;
  const [w, centers] = await Promise.all([
    getWorker(ctx.tenant.tenantId, id),
    listCenters(ctx.tenant.tenantId),
  ]);
  if (!w) notFound();
  const canEdit = can(ctx.permissions, "workers", "edit");
  const checks = w.kind === "contractor" ? await workerSsChecks(ctx.tenant.tenantId, id) : [];
  const today = todayYmd();
  return (
    <div className="space-y-4">
      <Link href="/personas" className="text-primary text-sm underline">
        ← Personas
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{w.fullName}</h1>
        {!isActive(w, today) && <Badge variant="warning">Retirado {formatDate(w.endDate)}</Badge>}
      </div>
      <Card>
        <CardTitle>Ficha</CardTitle>
        <div className="mt-3">
          {canEdit ? (
            <FormModal title="Editar datos" trigger="Editar datos" size="lg">
              <WorkerForm
                worker={
                  {
                    ...w,
                    createdAt: undefined,
                    updatedAt: undefined,
                    deletedAt: undefined,
                    tenantId: undefined,
                  } as never
                }
                centers={centers}
              />
            </FormModal>
          ) : (
            <p className="text-muted-foreground text-sm">Solo lectura. Documento: {w.idNumber}</p>
          )}
        </div>
      </Card>
      {canEdit && (
        <Card>
          <CardTitle>Retiro</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            El registro se conserva (mínimo 20 años desde el retiro).
          </p>
          <div className="mt-3">
            <FormModal title="Registrar retiro" trigger="Registrar retiro">
              <RetireForm id={w.id} start={w.startDate} />
            </FormModal>
          </div>
        </Card>
      )}
      {w.kind === "contractor" && (
        <Card>
          <CardTitle>Seguridad social (verificación mensual)</CardTitle>
          {checks.length > 0 && (
            <ul className="mt-2 divide-y text-sm">
              {checks.map((c) => (
                <li key={c.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    {c.period}
                    {c.note ? ` · ${c.note}` : ""}
                  </span>
                  <Badge variant={c.paid ? "success" : "destructive"}>
                    {c.paid ? "Pagado" : "No pagado"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <div className="mt-3">
              <FormModal title="Verificar seguridad social" trigger="Verificar seguridad social">
                <SsCheckForm id={w.id} period={previousPeriod(today)} />
              </FormModal>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
