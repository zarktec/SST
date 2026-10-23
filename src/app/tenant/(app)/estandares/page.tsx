import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { assessmentReminderFor, history, listAssessments } from "@/modules/assessment/service";
import { StartButton } from "./forms";

export const metadata = { title: "Estándares mínimos" };
const LEVEL: Record<string, [string, "destructive" | "warning" | "success"]> = {
  critico: ["Crítico", "destructive"],
  moderado: ["Moderadamente aceptable", "warning"],
  aceptable: ["Aceptable", "success"],
};

export default async function StandardsPage() {
  const ctx = await requirePermission("standards", "view");
  const tenantId = ctx.tenant.tenantId;
  const [list, trend, reminder] = await Promise.all([
    listAssessments(tenantId),
    history(tenantId),
    assessmentReminderFor(tenantId),
  ]);
  const year = new Date().getUTCFullYear();
  const canCreate = can(ctx.permissions, "standards", "create");
  const hasThisYear = list.some((a) => a.year === year);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Autoevaluación de estándares mínimos</h1>
      {reminder === "aplicar" && (
        <Alert variant="warning">
          Es momento de aplicar la autoevaluación de estándares mínimos del {year}.
        </Alert>
      )}
      {reminder === "registrar" && (
        <Alert variant="warning">
          Recuerda registrar la autoevaluación en la plataforma del Ministerio del Trabajo antes del
          plazo.
        </Alert>
      )}
      {canCreate && !hasThisYear && (
        <Card>
          <CardTitle>Nueva autoevaluación</CardTitle>
          <div className="mt-3">
            <StartButton year={year} />
          </div>
        </Card>
      )}
      <Card>
        <CardTitle>Historial</CardTitle>
        {list.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Aún no has iniciado ninguna autoevaluación.
          </p>
        ) : (
          <ul className="mt-2 divide-y text-sm">
            {list.map((a) => {
              const t = trend.find((x) => x.year === a.year);
              return (
                <li key={a.id}>
                  <Link
                    href={`/estandares/${a.id}`}
                    className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <span className="font-semibold">
                      {a.year} · {a.standardsGroup} estándares
                    </span>
                    <span className="flex items-center gap-2">
                      {a.status === "closed" ? (
                        <>
                          <span>
                            {a.scorePct}%
                            {t?.delta != null ? ` (${t.delta > 0 ? "+" : ""}${t.delta})` : ""}
                          </span>
                          {a.ratingLevel && (
                            <Badge variant={LEVEL[a.ratingLevel]?.[1]}>
                              {LEVEL[a.ratingLevel]?.[0] ?? a.ratingLevel}
                            </Badge>
                          )}
                          {a.registeredMinistryAt && (
                            <Badge>Registrada {formatDate(a.registeredMinistryAt)}</Badge>
                          )}
                        </>
                      ) : (
                        <Badge variant="warning">En borrador</Badge>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Link href="/estandares/plan" className="text-primary inline-block min-h-11 py-2 underline">
        Plan de mejoramiento
      </Link>
    </div>
  );
}
