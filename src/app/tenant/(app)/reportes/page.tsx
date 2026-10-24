import Link from "@/components/ui/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { listWorkCenters } from "@/modules/company/service";
import { KINDS, SEVERITIES, STATUS_LABEL } from "@/modules/unsafe-reports/rules";
import { countReports, listReports } from "@/modules/unsafe-reports/service";
import { Pager } from "@/components/ui/pager";
import { parsePage } from "@/lib/pagination";
import { ReportForm, ReviewForm } from "./forms";
import { FormModal } from "@/components/ui/modal";

export const metadata = { title: "Reportar condiciones y actos inseguros" };
const V: Record<string, "warning" | "success" | "default"> = {
  new: "warning",
  actioned: "success",
  dismissed: "default",
};

export default async function ReportsPage({ searchParams }: PageProps<"/tenant/reportes">) {
  const ctx = await requirePermission("unsafe_reports", "create");
  const t = ctx.tenant.tenantId;
  const all = can(ctx.permissions, "unsafe_reports", "view");
  const review = can(ctx.permissions, "unsafe_reports", "edit");
  const pg = parsePage(await searchParams);
  const [rows, total, centers] = await Promise.all([
    listReports(t, { all, userId: ctx.user.id, limit: pg.limit, offset: pg.offset }),
    countReports(t, { all, userId: ctx.user.id }),
    listWorkCenters(t),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reportar una condición o acto inseguro</h1>
      <Card>
        <FormModal
          title="Reportar acto o condición insegura"
          trigger="Reportar acto o condición insegura"
          triggerVariant="default"
          size="lg"
        >
          <ReportForm centers={centers.map((c) => ({ id: c.id, name: c.name }))} />
        </FormModal>
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
                {review && r.status === "new" && (
                  <FormModal title="Revisar" trigger="Revisar">
                    <ReviewForm id={r.id} />
                  </FormModal>
                )}
              </li>
            ))}
            {rows.length === 0 && <li className="text-muted-foreground py-2">Sin reportes.</li>}
          </ul>
          <Pager base="/reportes" page={pg.page} total={total} size={pg.size} />
        </Card>
      )}
    </div>
  );
}
