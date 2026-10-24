import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/forms/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { todayYmd } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { RISK_LEVELS } from "@/modules/pve/rules";
import { getCase, listCases } from "@/modules/pve/service";
import { closeCaseAction, followupAction } from "../../actions";

export const metadata = { title: "Caso de vigilancia" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function CasePage({ params }: PageProps<"/tenant/vigilancia/casos/[id]">) {
  const ctx = await requirePermission("medical", "view");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const t = ctx.tenant.tenantId;
  const summary = (await listCases(t)).find((c) => c.id === id);
  if (!summary) notFound();
  const detail = await getCase(t, ctx.user.id, id);
  const edit = can(ctx.permissions, "medical", "edit");
  const today = todayYmd();
  return (
    <div className="space-y-4">
      <Link href="/vigilancia" className="text-primary text-sm underline">
        ← Vigilancia epidemiológica
      </Link>
      <h1 className="text-2xl font-bold">{summary.workerName}</h1>
      <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
        {summary.program} · abierto {formatDate(summary.openedOn)}
        <Badge>{RISK_LEVELS.find((r) => r.value === summary.riskLevel)?.label}</Badge>
        {summary.status === "closed" ? (
          <Badge>Cerrado {summary.closedOn ? formatDate(summary.closedOn) : ""}</Badge>
        ) : (
          summary.nextFollowUpOn && (
            <Badge variant={summary.followUp === "vencido" ? "destructive" : "warning"}>
              Próximo seguimiento {formatDate(summary.nextFollowUpOn)}
            </Badge>
          )
        )}
      </p>
      {detail?.notes && (
        <Card>
          <CardTitle>Resumen del caso</CardTitle>
          <p className="mt-2 text-sm whitespace-pre-wrap">{detail.notes}</p>
        </Card>
      )}
      <Card>
        <CardTitle>Seguimientos</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {detail?.followups.map((f) => (
            <li key={f.id} className="py-2">
              <p className="font-semibold">{formatDate(f.performedOn)}</p>
              <p className="whitespace-pre-wrap">{f.note}</p>
            </li>
          ))}
          {detail?.followups.length === 0 && (
            <li className="text-muted-foreground py-2">Sin seguimientos.</li>
          )}
        </ul>
        {edit && summary.status === "open" && (
          <div className="mt-3 space-y-4">
            <ActionForm
              action={followupAction}
              idPrefix="fu-"
              hidden={{ id }}
              submit="Registrar seguimiento"
              fields={[
                { name: "performedOn", label: "Fecha", type: "date", saved: today, required: true },
                { name: "nextFollowUpOn", label: "Próximo seguimiento", type: "date" },
                {
                  name: "note",
                  label: "Seguimiento (cifrado; sin historia clínica)",
                  type: "textarea",
                },
              ]}
            />
            <ActionForm
              action={closeCaseAction}
              idPrefix="cc-"
              hidden={{ id }}
              submit="Cerrar caso"
              variant="outline"
              fields={[
                {
                  name: "closedOn",
                  label: "Fecha de cierre",
                  type: "date",
                  saved: today,
                  required: true,
                },
              ]}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
