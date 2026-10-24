import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatCOP, formatDate } from "@/lib/format";
import { CONCEPTS } from "@/modules/medical/rules";
import { getEvaluation } from "@/modules/medical/service";
import { IpsForm } from "../forms";
import { FormModal } from "@/components/ui/modal";

export const metadata = { title: "Evaluación médica ocupacional" };

export default async function EvaluationPage({ params }: PageProps<"/tenant/medicina/[id]">) {
  const ctx = await requirePermission("medical", "view");
  const e = await getEvaluation(ctx.tenant.tenantId, ctx.user.id, (await params).id);
  if (!e) notFound();
  return (
    <div className="space-y-4">
      <Link href="/medicina" className="text-primary text-sm underline">
        ← Medicina del trabajo
      </Link>
      <h1 className="text-2xl font-bold">{e.workerName}</h1>
      <p className="text-muted-foreground text-sm">
        Tipo: {e.type} ·{" "}
        {e.status === "done"
          ? `realizada ${formatDate(e.performedDate)}`
          : `programada ${e.scheduledDate ? formatDate(e.scheduledDate) : "—"}`}{" "}
        · IPS: {e.ipsName ?? "—"}
      </p>
      {e.status === "done" && (
        <Card>
          <CardTitle>Concepto</CardTitle>
          <p className="mt-2">
            <Badge variant="success">{CONCEPTS.find((c) => c.value === e.concept)?.label}</Badge>
          </p>
          {e.restrictions && (
            <p className="mt-2 text-sm">
              <strong>Restricciones:</strong> {e.restrictions}
            </p>
          )}
          {e.recommendations && (
            <p className="mt-2 text-sm">
              <strong>Recomendaciones:</strong> {e.recommendations}
            </p>
          )}
          {e.costCents !== null && (
            <p className="text-muted-foreground mt-2 text-sm">
              Costo asumido por el empleador: {formatCOP(e.costCents)}
            </p>
          )}
          {e.nextDueDate && (
            <p className="text-muted-foreground mt-1 text-sm">
              Próxima periódica: {formatDate(e.nextDueDate)}
            </p>
          )}
          <p className="text-muted-foreground mt-2 text-xs">Esta consulta quedó registrada.</p>
        </Card>
      )}
      {e.status === "scheduled" && can(ctx.permissions, "medical", "edit") && (
        <Card>
          <CardTitle>Enviar a la IPS</CardTitle>
          <div className="mt-3">
            <FormModal title="Enviar a la IPS" trigger="Enviar a la IPS" triggerVariant="default">
              <IpsForm id={e.id} />
            </FormModal>
          </div>
        </Card>
      )}
    </div>
  );
}
