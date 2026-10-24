import { FormModal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { getMatrix } from "@/modules/legal/service";
import { EntryForm } from "./entry-form";

export const metadata = { title: "Matriz legal" };
const STATE: Record<string, ["success" | "warning" | "destructive" | "default", string]> = {
  cumple: ["success", "Cumple"],
  parcial: ["warning", "Parcial"],
  no_cumple: ["destructive", "No cumple"],
  pending: ["default", "Pendiente"],
};

export default async function LegalMatrix() {
  const ctx = await requirePermission("legal_matrix", "view");
  const { lines, summary } = await getMatrix(ctx.tenant.tenantId);
  const canEdit = can(ctx.permissions, "legal_matrix", "edit");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Matriz legal</h1>
      {lines.length === 0 && (
        <Alert>
          La matriz base aún no está cargada. Contacta al administrador de la plataforma.
        </Alert>
      )}
      {summary.unevaluated > 0 && lines.length > 0 && (
        <Alert variant="warning">
          {summary.unevaluated} elementos sin evaluar (incluye normas nuevas publicadas).
        </Alert>
      )}
      <Card>
        <p className="text-lg font-semibold">{summary.compliancePct}% de cumplimiento</p>
        <p className="text-muted-foreground text-sm">
          {summary.cumple} cumplen · {summary.parcial} parciales · {summary.noCumple} no cumplen ·{" "}
          {summary.pendingCompliance} por verificar · {summary.notApplicable} no aplican ·{" "}
          {summary.reviewDue} con revisión vencida
        </p>
      </Card>
      <Card>
        <CardTitle>Normas y requisitos</CardTitle>
        <ul className="mt-2 divide-y">
          {lines.map((l) => (
            <li
              key={`${l.kind}-${l.code}`}
              className={`py-3 ${l.kind === "requirement" ? "pl-4" : ""}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <span className="font-semibold">{l.title}</span> · {l.detail}
                  {l.periodicity && (
                    <span className="text-muted-foreground"> ({l.periodicity})</span>
                  )}
                  {l.url && (
                    <a
                      href={l.url}
                      className="text-primary ml-2 text-sm underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver norma
                    </a>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {!l.entry ? (
                    <Badge variant="warning">Sin evaluar</Badge>
                  ) : l.entry.applies === "no" ? (
                    <Badge>No aplica</Badge>
                  ) : (
                    <Badge variant={STATE[l.entry.compliance][0]}>
                      {STATE[l.entry.compliance][1]}
                    </Badge>
                  )}
                  {canEdit && (
                    <FormModal
                      title={`Evaluar: ${l.title}`}
                      description={l.detail}
                      trigger={l.entry ? "Editar" : "Evaluar"}
                      triggerVariant={l.entry ? "outline" : "default"}
                    >
                      <EntryForm
                        kind={l.kind}
                        code={l.code}
                        entry={l.entry ? { ...l.entry } : null}
                      />
                    </FormModal>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
