import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { getMatrix, listMatrices, loadScales, reviewStatus } from "@/modules/hazards/service";
import { listCenters } from "@/modules/workers/service";
import { ApproveButton, DeleteRowButton, DraftButton, ParticipationForm, RowForm } from "./forms";
import { FormModal } from "@/components/ui/modal";

export const metadata = { title: "Matriz de peligros" };
const RISK: Record<string, "destructive" | "warning" | "default" | "success"> = {
  I: "destructive",
  II: "destructive",
  III: "warning",
  IV: "success",
};
const REASON: Record<string, string> = {
  initial: "Inicial",
  annual: "Revisión anual",
  serious_accident: "Accidente grave",
  change: "Cambio",
};

export default async function Hazards() {
  const ctx = await requirePermission("hazard_matrix", "view");
  const tenantId = ctx.tenant.tenantId;
  const [matrices, review, centers] = await Promise.all([
    listMatrices(tenantId),
    reviewStatus(tenantId),
    listCenters(tenantId),
  ]);
  const current =
    matrices.find((m) => m.status === "draft") ?? matrices.find((m) => m.status === "approved");
  const data = current ? await getMatrix(tenantId, current.id) : null;
  const canCreate = can(ctx.permissions, "hazard_matrix", "create");
  const canEdit = can(ctx.permissions, "hazard_matrix", "edit") && current?.status === "draft";
  let scales: {
    deficiency: { level: string; meaning: string }[];
    exposure: { level: string; meaning: string }[];
    consequence: { level: string; meaning: string }[];
  } | null = null;
  try {
    const s = (await loadScales()).scales;
    const pick = (d: string) =>
      s
        .filter((x) => x.dimension === d && x.value !== null)
        .map((x) => ({ level: x.level, meaning: x.meaning }));
    scales = {
      deficiency: pick("deficiency"),
      exposure: pick("exposure"),
      consequence: pick("consequence"),
    };
  } catch {
    scales = null;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Matriz de peligros y valoración de riesgos (GTC 45)</h1>
      {!scales && (
        <Alert variant="warning">Las escalas de valoración GTC 45 aún no están cargadas.</Alert>
      )}
      {review.hasApproved && review.due && !review.hasDraft && (
        <Alert variant="warning">
          La matriz debe actualizarse (mínimo una vez al año, o tras un accidente grave o un
          cambio).
        </Alert>
      )}
      {!review.hasApproved && !review.hasDraft && (
        <Alert>Aún no has elaborado tu matriz de peligros.</Alert>
      )}
      {canCreate && !review.hasDraft && scales && (
        <Card>
          <CardTitle>{review.hasApproved ? "Nueva versión" : "Primera matriz"}</CardTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            {review.hasApproved ? (
              <>
                <DraftButton reason="annual" label="Revisión anual" />
                <DraftButton reason="serious_accident" label="Por accidente grave" />
                <DraftButton reason="change" label="Por cambio en el proceso" />
              </>
            ) : (
              <DraftButton reason="initial" label="Crear matriz" />
            )}
          </div>
        </Card>
      )}
      {current && data && (
        <>
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold">Versión {current.version}</p>
              <Badge variant={current.status === "approved" ? "success" : "warning"}>
                {current.status === "approved"
                  ? `Aprobada ${formatDate(current.approvedAt)}`
                  : "Borrador"}
              </Badge>
              <Badge>{REASON[current.reason]}</Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {data.summary.total} peligros · I: {data.summary.I} · II: {data.summary.II} · III:{" "}
              {data.summary.III} · IV: {data.summary.IV}
              {data.summary.unvalued > 0 && ` · ${data.summary.unvalued} sin valorar`}
            </p>
            {current.participation && (
              <p className="mt-2 text-sm">Participación: {current.participation}</p>
            )}
            {canEdit && can(ctx.permissions, "hazard_matrix", "approve") && (
              <div className="mt-3">
                <ApproveButton id={current.id} />
              </div>
            )}
          </Card>
          {canEdit && (
            <Card>
              <CardTitle>Participación de los trabajadores</CardTitle>
              <div className="mt-3">
                <FormModal title="Registrar participación" trigger="Registrar participación">
                  <ParticipationForm matrixId={current.id} saved={current.participation} />
                </FormModal>
              </div>
            </Card>
          )}
          {data.rows.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">
                  {r.hazardFamily} · {r.hazardName}
                </p>
                {r.riskLevel ? (
                  <Badge variant={RISK[r.riskLevel]}>
                    Riesgo {r.riskLevel} · NR {r.nr}
                  </Badge>
                ) : (
                  <Badge>Sin valorar</Badge>
                )}
                {r.acceptability && <Badge>{r.acceptability}</Badge>}
              </div>
              <p className="text-muted-foreground text-sm">
                {r.process} › {r.activity} › {r.task} · {r.routine ? "rutinaria" : "no rutinaria"} ·{" "}
                {r.exposedWorkers} expuestos
              </p>
              <p className="text-sm">
                ND {r.deficiency} · NE {r.exposure} · NC {r.consequence}
                {r.np !== null ? ` · NP ${r.np} (${r.probabilityLevel})` : ""}
              </p>
              {(data.warnings.get(r.id) ?? []).map((w) => (
                <Alert key={w} variant="warning" className="mt-2">
                  {w}
                </Alert>
              ))}
              {canEdit && (
                <FormModal title="Editar" trigger="Editar" triggerClassName="mt-2">
                  {scales && (
                    <RowForm
                      matrixId={current.id}
                      centers={centers}
                      scales={scales}
                      row={{ ...r, createdAt: undefined, updatedAt: undefined } as never}
                    />
                  )}
                  <div className="mt-2">
                    <DeleteRowButton matrixId={current.id} rowId={r.id} />
                  </div>
                </FormModal>
              )}
            </Card>
          ))}
          {canEdit && scales && (
            <Card>
              <CardTitle>Agregar peligro</CardTitle>
              <div className="mt-3">
                <FormModal
                  title="Agregar peligro"
                  trigger="Agregar peligro"
                  triggerVariant="default"
                  size="lg"
                >
                  <RowForm matrixId={current.id} centers={centers} scales={scales} />
                </FormModal>
              </div>
            </Card>
          )}
        </>
      )}
      {matrices.length > 1 && (
        <Card>
          <CardTitle>Historial de versiones</CardTitle>
          <ul className="mt-2 divide-y text-sm">
            {matrices.map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  Versión {m.version} · {REASON[m.reason]}
                </span>
                <Badge>
                  {m.status === "approved"
                    ? "Vigente"
                    : m.status === "draft"
                      ? "Borrador"
                      : "Reemplazada"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
