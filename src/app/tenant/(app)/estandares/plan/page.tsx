import { formatDate } from "@/lib/format";
import Link from "@/components/ui/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { listAssessments, listImprovements } from "@/modules/assessment/service";
import { ImprovementForm } from "../forms";
import { todayYmd } from "@/lib/dates";
import { FormModal } from "@/components/ui/modal";

export const metadata = { title: "Plan de mejoramiento" };

export default async function ImprovementPlan() {
  const ctx = await requirePermission("standards", "view");
  const [items, assessments] = await Promise.all([
    listImprovements(ctx.tenant.tenantId),
    listAssessments(ctx.tenant.tenantId),
  ]);
  const year = new Map(assessments.map((a) => [a.id, a.year]));
  const canEdit = can(ctx.permissions, "standards", "edit");
  const today = todayYmd();
  const open = items.filter((i) => i.status !== "done");
  return (
    <div className="space-y-4">
      <Link href="/estandares" className="text-primary text-sm underline">
        ← Autoevaluaciones
      </Link>
      <h1 className="text-2xl font-bold">Plan de mejoramiento</h1>
      <p className="text-muted-foreground text-sm">
        {open.length} acciones abiertas ·{" "}
        {open.filter((i) => i.dueDate && i.dueDate < today).length} vencidas
      </p>
      {items.length === 0 && (
        <Card>
          <p className="text-muted-foreground text-sm">
            Se genera al cerrar una autoevaluación con ítems que no cumplen.
          </p>
        </Card>
      )}
      {items.map((i) => (
        <Card key={i.id}>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge>{year.get(i.assessmentId)}</Badge>
            {i.status === "done" ? (
              <Badge variant="success">Cerrada</Badge>
            ) : i.dueDate && i.dueDate < today ? (
              <Badge variant="destructive">Vencida</Badge>
            ) : (
              <Badge variant="warning">Abierta</Badge>
            )}
          </div>
          <p className="text-sm">
            <span className="font-semibold">{i.itemCode}</span> · {i.description}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {i.responsibleName ? `Responsable: ${i.responsibleName}` : "Sin responsable"}
            {i.dueDate ? ` · vence ${formatDate(i.dueDate)}` : ""}
          </p>
          {canEdit && (
            <div className="mt-2">
              <FormModal title="Editar acción de mejoramiento" trigger="Editar">
                <ImprovementForm it={i} />
              </FormModal>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
