import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatCOP, formatDate, formatDateTime } from "@/lib/format";
import { isOverdue, monthsOf } from "@/modules/annual-plan/rules";
import { getPlan } from "@/modules/annual-plan/service";
import { ActivityForm, CreatePlan, Reopen, Sign, StatusForm, Suggest } from "./forms";

export const metadata = { title: "Plan anual de trabajo" };
const PHVA: Record<string, string> = { P: "Planear", H: "Hacer", V: "Verificar", A: "Actuar" };
const MONTHS = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const ST: Record<string, [string, "default" | "warning" | "success" | "destructive"]> = {
  pending: ["Pendiente", "default"],
  in_progress: ["En curso", "warning"],
  done: ["Realizada", "success"],
  cancelled: ["Cancelada", "default"],
};

export default async function AnnualPlanPage({ searchParams }: PageProps<"/tenant/plan-anual">) {
  const ctx = await requirePermission("annual_plan", "view");
  const sp = await searchParams;
  const thisYear = new Date().getUTCFullYear();
  const year = Number(sp.anio) >= 2020 && Number(sp.anio) <= 2100 ? Number(sp.anio) : thisYear;
  const data = await getPlan(ctx.tenant.tenantId, year);
  const today = new Date().toISOString().slice(0, 10);
  const canCreate = can(ctx.permissions, "annual_plan", "create");
  const signed = data?.plan.status === "signed";
  const canEdit = can(ctx.permissions, "annual_plan", "edit");
  const canSign = can(ctx.permissions, "annual_plan", "approve");
  const role = ctx.roleKey;
  const budget =
    data?.activities
      .filter((a) => a.status !== "cancelled")
      .reduce((s, a) => s + (a.budgetCents ?? 0n), 0n) ?? 0n;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Plan anual de trabajo {year}</h1>
      <nav className="flex gap-2" aria-label="Año">
        {[year - 1, year, year + 1].map((y) => (
          <Link
            key={y}
            href={`/plan-anual?anio=${y}`}
            className={`min-h-11 rounded-md border px-3 py-2 text-sm ${y === year ? "bg-primary text-primary-foreground" : ""}`}
          >
            {y}
          </Link>
        ))}
      </nav>
      {!data && (
        <Card>
          <p className="text-muted-foreground text-sm">Aún no hay plan para {year}.</p>
          {canCreate && (
            <div className="mt-3">
              <CreatePlan year={year} />
            </div>
          )}
        </Card>
      )}
      {data && (
        <>
          <Card>
            <p className="text-lg font-semibold">
              {data.progress.pct}% de cumplimiento{" "}
              <Badge variant={signed ? "success" : "warning"}>
                {signed ? "Firmado" : "Borrador"}
              </Badge>
            </p>
            <p className="text-muted-foreground text-sm">
              {data.progress.done} de {data.progress.total} actividades realizadas · presupuesto{" "}
              {formatCOP(budget)}
            </p>
            {signed && (
              <p className="mt-2 text-sm">
                Firmado por el empleador el {formatDateTime(data.plan.employerSignedAt)} y por el
                responsable del SG-SST el {formatDateTime(data.plan.responsibleSignedAt)}. Huella:{" "}
                <code className="text-xs break-all">{data.plan.contentHash?.slice(0, 16)}…</code>
              </p>
            )}
            {!signed && (data.plan.employerSignedAt || data.plan.responsibleSignedAt) && (
              <p className="mt-2 text-sm">
                Firmas: empleador {data.plan.employerSignedAt ? "✓" : "pendiente"} · responsable{" "}
                {data.plan.responsibleSignedAt ? "✓" : "pendiente"}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              {canSign &&
                !signed &&
                !data.plan.employerSignedAt &&
                (role === "ALTA_DIRECCION" || role === "ADMIN_EMPRESA") && (
                  <Sign planId={data.plan.id} as="employer" label="Firmar como empleador" />
                )}
              {canSign &&
                !signed &&
                !data.plan.responsibleSignedAt &&
                role === "RESPONSABLE_SST" && (
                  <Sign
                    planId={data.plan.id}
                    as="responsible"
                    label="Firmar como responsable del SG-SST"
                  />
                )}
              {canSign &&
                (signed || data.plan.employerSignedAt || data.plan.responsibleSignedAt) && (
                  <Reopen planId={data.plan.id} />
                )}
              {canEdit && !signed && <Suggest planId={data.plan.id} />}
            </div>
          </Card>

          {data.activities.length > 0 && (
            <Card>
              <CardTitle>Cronograma</CardTitle>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr>
                      <th className="text-left font-medium">Actividad</th>
                      {MONTHS.map((m, i) => (
                        <th key={i} scope="col" className="w-8 font-medium">
                          {m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.activities.map((a) => {
                      const ms = monthsOf(a, year);
                      return (
                        <tr key={a.id}>
                          <th
                            scope="row"
                            className="max-w-48 truncate py-1 pr-2 text-left font-normal"
                          >
                            {a.title}
                          </th>
                          {MONTHS.map((_, i) => (
                            <td key={i} className="p-0.5">
                              <div
                                className={`h-4 rounded ${ms.includes(i + 1) ? (a.status === "done" ? "bg-emerald-600" : isOverdue(a, today) ? "bg-destructive" : "bg-primary") : "bg-muted"}`}
                                aria-label={ms.includes(i + 1) ? "programada" : undefined}
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {data.activities.map((a) => (
            <Card key={a.id}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{a.title}</p>
                <Badge variant={ST[a.status][1]}>{ST[a.status][0]}</Badge>
                {isOverdue(a, today) && <Badge variant="destructive">Vencida</Badge>}
                <Badge>{PHVA[a.phva]}</Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                {formatDate(a.startDate)} → {formatDate(a.endDate)}
                {a.responsibleName ? ` · ${a.responsibleName}` : ""}
                {a.budgetCents != null ? ` · ${formatCOP(a.budgetCents)}` : ""}
              </p>
              {canEdit && (
                <details className="mt-2">
                  <summary className="text-primary min-h-11 cursor-pointer py-2 text-sm">
                    Gestionar
                  </summary>
                  <div className="space-y-4">
                    <StatusForm activity={{ ...a }} />
                    {!signed && <ActivityForm planId={data.plan.id} activity={{ ...a }} />}
                  </div>
                </details>
              )}
            </Card>
          ))}
          {canEdit && !signed && (
            <Card>
              <CardTitle>Agregar actividad</CardTitle>
              <div className="mt-3">
                <ActivityForm planId={data.plan.id} />
              </div>
            </Card>
          )}
          {signed && (
            <Alert>
              El plan está firmado: solo se actualiza el avance. Para modificar actividades,
              reábrelo.
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
