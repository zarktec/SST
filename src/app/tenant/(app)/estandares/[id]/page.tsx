import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { getActiveItems } from "@/modules/platform/catalogs/service";
import { ratingFor, type RatingRange } from "@/modules/assessment/rules";
import { getAssessment } from "@/modules/assessment/service";
import { CloseButton, ItemForm, MinistryForm } from "../forms";

export const metadata = { title: "Autoevaluación" };
const PHVA: Record<string, string> = { P: "Planear", H: "Hacer", V: "Verificar", A: "Actuar" };

export default async function AssessmentPage({ params }: PageProps<"/tenant/estandares/[id]">) {
  const ctx = await requirePermission("standards", "view");
  const data = await getAssessment(ctx.tenant.tenantId, (await params).id);
  if (!data) notFound();
  const { assessment: a, items, live } = data;
  const closed = a.status === "closed";
  const canEdit = can(ctx.permissions, "standards", "edit") && !closed;
  const ranges = (await getActiveItems<RatingRange>("rating_ranges"))?.items ?? [];
  const rating = closed
    ? ranges.find((r) => r.level === a.ratingLevel)
    : ratingFor(live.pct, ranges);
  const answered = items.filter((i) => i.status !== "pending").length;

  const byStandard = new Map<string, typeof items>();
  for (const i of items) {
    const k = `${i.snapshot.phva}|${i.snapshot.standardCode}|${i.snapshot.standardName}`;
    byStandard.set(k, [...(byStandard.get(k) ?? []), i]);
  }

  return (
    <div className="space-y-4">
      <Link href="/estandares" className="text-primary text-sm underline">
        ← Autoevaluaciones
      </Link>
      <h1 className="text-2xl font-bold">Autoevaluación {a.year}</h1>
      <Card>
        <p className="text-lg font-semibold">
          {closed ? a.scorePct : live.pct}%{" "}
          {rating && (
            <Badge
              variant={
                rating.level === "critico"
                  ? "destructive"
                  : rating.level === "moderado"
                    ? "warning"
                    : "success"
              }
            >
              {rating.label}
            </Badge>
          )}
        </p>
        <p className="text-muted-foreground text-sm">
          {answered} de {items.length} ítems calificados · {a.standardsGroup} estándares
          {closed ? " · cerrada" : " · borrador (el puntaje se calcula con lo calificado)"}
        </p>
        {rating && rating.actions.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-sm">
            {rating.actions.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        )}
        {!closed && can(ctx.permissions, "standards", "approve") && (
          <div className="mt-3">
            <CloseButton id={a.id} />
          </div>
        )}
        {closed && (
          <p className="mt-2 text-sm">
            <Link href="/estandares/plan" className="text-primary underline">
              Ver plan de mejoramiento
            </Link>
          </p>
        )}
      </Card>
      {closed && can(ctx.permissions, "standards", "approve") && (
        <Card>
          <CardTitle>Registro ante el Ministerio del Trabajo</CardTitle>
          {a.registeredMinistryAt ? (
            <p className="mt-2 text-sm">Registrada el {a.registeredMinistryAt}.</p>
          ) : (
            <div className="mt-3">
              <MinistryForm id={a.id} />
            </div>
          )}
        </Card>
      )}
      {!canEdit && !closed && <Alert>Tienes acceso de solo lectura.</Alert>}
      {[...byStandard.entries()].map(([k, list]) => {
        const [phva, code, name] = k.split("|");
        return (
          <Card key={k}>
            <CardTitle>
              {PHVA[phva] ?? phva} · {code}. {name}
            </CardTitle>
            <ul className="mt-2 divide-y">
              {list.map((i) => (
                <li key={i.id} className="py-3">
                  <ItemForm
                    assessmentId={a.id}
                    readOnly={!canEdit}
                    item={{ ...i, snapshot: i.snapshot }}
                  />
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
