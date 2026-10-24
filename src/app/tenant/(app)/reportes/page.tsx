import Link from "@/components/ui/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { listWorkCenters } from "@/modules/company/service";
import { KINDS, SEVERITIES, STATUS_LABEL } from "@/modules/unsafe-reports/rules";
import { listReports } from "@/modules/unsafe-reports/service";
import { ReportForm, ReviewForm } from "./forms";

export const metadata = { title: "Reportar condiciones y actos inseguros" };
const V: Record<string, "warning" | "success" | "default"> = {
  new: "warning",
  actioned: "success",
  dismissed: "default",
};

export default async function ReportsPage() {
  const ctx = await requirePermission("unsafe_reports", "create");
  const t = ctx.tenant.tenantId;
  const all = can(ctx.permissions, "unsafe_reports", "view");
  const review = can(ctx.permissions, "unsafe_reports", "edit");
  const [rows, centers] = await Promise.all([
    listReports(t, { all, userId: ctx.user.id }),
    listWorkCenters(t),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reportar una condición o acto inseguro</h1>
      <Card>
        <ReportForm centers={centers.map((c) => ({ id: c.id, name: c.name }))} />
      </Card>
      {(all || rows.length > 0) && (
        <Card>
          <CardTitle>{all ? "Reportes de la empresa" : "Mis reportes"}</CardTitle>
          <ul className="mt-2 divide-y text-sm">
            {rows.map((r) => (
              <li key={r.id} className="space-y-2 py-3">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge variant={V[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                  <span className="font-semibold">
                    {KINDS.find((k) => k.value === r.kind)?.label}
                  </span>
                  <span className="text-muted-foreground">
                    · severidad{" "}
                    {SEVERITIES.find((s) => s.value === r.severity)?.label.toLowerCase()}
                    {r.place ? ` · ${r.place}` : ""}
                    {r.anonymous ? " · anónimo" : ""}
                  </span>
                </p>
                <p className="whitespace-pre-wrap">{r.description}</p>
                {r.reviewNote && <p className="text-muted-foreground">Revisión: {r.reviewNote}</p>}
                {r.actionId && (
                  <Link className="text-primary underline" href={`/acciones/${r.actionId}`}>
                    Ver la acción
                  </Link>
                )}
                {review && r.status === "new" && <ReviewForm id={r.id} />}
              </li>
            ))}
            {rows.length === 0 && <li className="text-muted-foreground py-2">Sin reportes.</li>}
          </ul>
        </Card>
      )}
    </div>
  );
}
