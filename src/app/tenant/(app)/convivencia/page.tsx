import Link from "@/components/ui/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/core/auth/session";
import { withTenant } from "@/core/db";
import { can, loadPermissions } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { STAGE_LABEL, type Stage } from "@/modules/convivencia/rules";
import { AccessDeniedError, cclMembership, listComplaints } from "@/modules/convivencia/service";
import { activeCommittees } from "@/modules/committees/service";
import { ConfidentialityForm } from "./forms";
import { FormModal } from "@/components/ui/modal";

export const metadata = { title: "Convivencia laboral" };

export default async function ConvivenciaPage() {
  const ctx = await requireTenantMember();
  const t = ctx.tenant.tenantId;
  const perms = await withTenant({ tenantId: t }, (tx) => loadPermissions(tx, ctx.roleId));
  const hasRole = can(perms, "ccl", "view");
  const [committees, membership] = await Promise.all([
    activeCommittees(t, ["ccl"]),
    hasRole ? cclMembership(t, ctx.user.email) : null,
  ]);
  let complaints: Awaited<ReturnType<typeof listComplaints>> | null = null;
  let denied: string | null = null;
  if (hasRole) {
    try {
      complaints = await listComplaints(t, { userId: ctx.user.id, email: ctx.user.email });
    } catch (e) {
      if (e instanceof AccessDeniedError) denied = e.message;
      else throw e;
    }
  }
  const needsSignature = membership && membership.memberships.every((m) => !m.confidentialityAt);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Convivencia laboral</h1>
      <Card>
        <CardTitle>Comité de Convivencia Laboral</CardTitle>
        {committees.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">Aún no hay comité conformado.</p>
        ) : (
          <ul className="mt-2 divide-y text-sm">
            {committees.map((c) => (
              <li key={c.id} className="py-2">
                <span className="font-semibold">
                  {c.workCenterId ? "Comité de sede" : "Comité central"}
                </span>{" "}
                · {formatDate(c.periodStart)} → {formatDate(c.periodEnd)} · {c.members.length}{" "}
                integrantes
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <Link href="/convivencia/radicar" className="text-primary min-h-11 py-2 underline">
            Radicar una queja confidencial
          </Link>
          <Link href="/acoso-sexual/radicar" className="text-primary min-h-11 py-2 underline">
            Reportar acoso sexual o violencia de género
          </Link>
          {can(perms, "committees", "create") && (
            <Link href="/convivencia/conformar" className="text-primary min-h-11 py-2 underline">
              Conformar el comité
            </Link>
          )}
        </div>
      </Card>
      {needsSignature && (
        <Card>
          <CardTitle>Acuerdo de confidencialidad</CardTitle>
          <div className="mt-3">
            <FormModal
              title="Firmar acuerdo de confidencialidad"
              trigger="Firmar acuerdo de confidencialidad"
              triggerVariant="default"
            >
              <ConfidentialityForm />
            </FormModal>
          </div>
        </Card>
      )}
      {hasRole && denied && !needsSignature && <Alert variant="warning">{denied}</Alert>}
      {complaints && (
        <Card>
          <CardTitle>Quejas ({complaints.length})</CardTitle>
          <ul className="mt-2 divide-y text-sm">
            {complaints.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/convivencia/quejas/${c.id}`}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3"
                >
                  <span>
                    Recibida {formatDate(c.receivedAt)}
                    {c.stageDueAt && !c.closedAt ? ` · plazo ${formatDate(c.stageDueAt)}` : ""}
                  </span>
                  <span className="flex gap-2">
                    {c.overdue && <Badge variant="destructive">Plazo vencido</Badge>}
                    <Badge>{STAGE_LABEL[c.stage as Stage]}</Badge>
                  </span>
                </Link>
              </li>
            ))}
            {complaints.length === 0 && (
              <li className="text-muted-foreground py-2">No hay quejas.</li>
            )}
          </ul>
          <p className="text-muted-foreground mt-2 text-xs">
            Cada consulta a esta información queda registrada.
          </p>
        </Card>
      )}
    </div>
  );
}
