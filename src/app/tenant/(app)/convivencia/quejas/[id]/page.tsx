import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate, formatDateTime } from "@/lib/format";
import { STAGE_LABEL, type Stage } from "@/modules/convivencia/rules";
import { AccessDeniedError, getComplaint } from "@/modules/convivencia/service";
import { AdvanceForm } from "../../forms";
import { FormModal } from "@/components/ui/modal";

export const metadata = { title: "Queja de convivencia" };

export default async function ComplaintPage({
  params,
}: PageProps<"/tenant/convivencia/quejas/[id]">) {
  const ctx = await requirePermission("ccl", "view");
  let data: Awaited<ReturnType<typeof getComplaint>>;
  try {
    data = await getComplaint(
      ctx.tenant.tenantId,
      { userId: ctx.user.id, email: ctx.user.email },
      (await params).id,
    );
  } catch (e) {
    if (e instanceof AccessDeniedError) return <Alert variant="warning">{e.message}</Alert>;
    throw e;
  }
  if (!data) notFound();
  const { complaint: c, events, next } = data;
  return (
    <div className="space-y-4">
      <Link href="/convivencia" className="text-primary text-sm underline">
        ← Convivencia
      </Link>
      <h1 className="text-2xl font-bold">Queja recibida el {formatDate(c.receivedAt)}</h1>
      <p className="flex flex-wrap gap-2 text-sm">
        <Badge>{STAGE_LABEL[c.stage as Stage]}</Badge>
        {c.overdue && <Badge variant="destructive">Plazo vencido</Badge>}
        {c.stageDueAt && !c.closedAt && (
          <span className="text-muted-foreground">
            Plazo de la etapa: {formatDate(c.stageDueAt)}
          </span>
        )}
      </p>
      <Card>
        <CardTitle>Relato</CardTitle>
        <p className="mt-2 text-sm whitespace-pre-wrap">{c.narrative}</p>
        <p className="text-muted-foreground mt-2 text-sm">
          Quejoso: {c.complainantName ?? "anónimo"} · Persona señalada:{" "}
          {c.respondentName ?? "no identificada"}
        </p>
      </Card>
      {next.length > 0 && can(ctx.permissions, "ccl", "edit") && (
        <Card>
          <CardTitle>Dar el siguiente paso</CardTitle>
          <div className="mt-3">
            <FormModal title="Avanzar trámite" trigger="Avanzar trámite" triggerVariant="default">
              <AdvanceForm id={c.id} next={next} />
            </FormModal>
          </div>
        </Card>
      )}
      <Card>
        <CardTitle>Trazabilidad</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {events.map((e) => (
            <li key={e.id} className="py-2">
              <span className="font-semibold">{STAGE_LABEL[e.stage as Stage]}</span> ·{" "}
              {formatDateTime(e.at)}
              {e.note && <p className="whitespace-pre-wrap">{e.note}</p>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
