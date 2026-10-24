import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate, formatDateTime } from "@/lib/format";
import { SOURCES, STATUS_LABEL, TYPES, canMove, type Status } from "@/modules/capa/rules";
import { getAction } from "@/modules/capa/service";
import { EditForm, MoveForm, VerifyForm } from "../forms";

export const metadata = { title: "Acción" };

export default async function ActionPage({ params }: PageProps<"/tenant/acciones/[id]">) {
  const ctx = await requirePermission("actions", "view");
  const a = await getAction(ctx.tenant.tenantId, (await params).id);
  if (!a) notFound();
  const canEdit = can(ctx.permissions, "actions", "edit");
  const options = (["in_progress", "done", "cancelled"] as Status[])
    .filter((s) => canMove(a.status as Status, s))
    .map((s) => ({ value: s, label: STATUS_LABEL[s] }));
  return (
    <div className="space-y-4">
      <Link href="/acciones" className="text-primary text-sm underline">
        ← Acciones
      </Link>
      <h1 className="text-2xl font-bold">{a.title}</h1>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Badge>{TYPES.find((t) => t.value === a.type)?.label}</Badge>
        <Badge>{STATUS_LABEL[a.status as Status]}</Badge>
        <span className="text-muted-foreground">
          Origen: {SOURCES[a.source]} · vence {formatDate(a.dueDate)}
        </span>
        {a.overdueDays > 0 && <Badge variant="destructive">{a.overdueDays} días de mora</Badge>}
      </p>
      {a.description && (
        <Card>
          <p className="text-sm whitespace-pre-wrap">{a.description}</p>
        </Card>
      )}
      {canEdit && (a.status === "open" || a.status === "in_progress") && (
        <Card>
          <CardTitle>Responsable, fecha y causa</CardTitle>
          <div className="mt-3">
            <EditForm a={a} />
          </div>
        </Card>
      )}
      {a.rootCause && !(canEdit && (a.status === "open" || a.status === "in_progress")) && (
        <Card>
          <CardTitle>Análisis de causa</CardTitle>
          <p className="mt-2 text-sm whitespace-pre-wrap">{a.rootCause}</p>
        </Card>
      )}
      {canEdit && options.length > 0 && (
        <Card>
          <CardTitle>Avance</CardTitle>
          <div className="mt-3">
            <MoveForm id={a.id} options={options} />
          </div>
        </Card>
      )}
      {a.closureEvidence && (
        <Card>
          <CardTitle>Evidencia de cierre</CardTitle>
          <p className="mt-2 text-sm whitespace-pre-wrap">{a.closureEvidence}</p>
          <p className="text-muted-foreground mt-1 text-xs">{formatDateTime(a.closedAt)}</p>
        </Card>
      )}
      {a.status === "done" && can(ctx.permissions, "actions", "approve") && (
        <Card>
          <CardTitle>Verificación de eficacia</CardTitle>
          <div className="mt-3">
            <VerifyForm id={a.id} />
          </div>
        </Card>
      )}
      {a.status === "verified" && (
        <Alert variant={a.effective === "yes" ? "success" : "warning"}>
          {a.effective === "yes"
            ? "Verificada como eficaz"
            : "No fue eficaz: se abrió una nueva acción"}
          . {a.effectivenessNote}
        </Alert>
      )}
    </div>
  );
}
