import { FormModal } from "@/components/ui/modal";
import { ActionForm } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { todayYmd } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { KINDS } from "@/modules/documents/rules";
import { acksFor, masterList, templatesFor } from "@/modules/documents/service";
import { approveAction, createDocumentAction, draftAction } from "./actions";

export const metadata = { title: "Documentos" };
const REVIEW = {
  vigente: ["success", "Vigente"],
  por_revisar: ["warning", "Por revisar"],
  sin_revision: ["default", "Sin revisión periódica"],
  sin_aprobar: ["destructive", "Sin versión aprobada"],
} as const;
const label = (v: string) => KINDS.find((k) => k.value === v)?.label ?? v;

export default async function DocumentsPage() {
  const ctx = await requirePermission("documents", "view");
  const t = ctx.tenant.tenantId;
  const create = can(ctx.permissions, "documents", "create");
  const edit = can(ctx.permissions, "documents", "edit");
  const today = todayYmd();
  const [docs, templates] = await Promise.all([
    masterList(t),
    create ? templatesFor(t) : Promise.resolve([]),
  ]);
  const hasPolicy = docs.some((d) => d.kind === "policy" && d.current);
  const acks = new Map(
    await Promise.all(
      docs
        .filter((d) => d.kind === "policy" && d.current)
        .map(async (d) => [d.current!.id, await acksFor(t, d.current!.id)] as const),
    ),
  );
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Documentos controlados</h1>
      {!hasPolicy && (
        <Alert variant="warning">Aún no hay una política de SST aprobada y vigente.</Alert>
      )}
      <p className="text-muted-foreground text-sm">
        Lista maestra con versiones, aprobación firmada y vigencia. Quien redacta no puede aprobar
        su propio documento. Las versiones aprobadas no se modifican ni se borran (conservación de
        registros).
      </p>
      {docs.map((d) => {
        const [variant, txt] = REVIEW[d.review];
        const canApprove = can(
          ctx.permissions,
          d.kind === "policy" ? "policy" : "documents",
          "approve",
        );
        return (
          <Card key={d.id}>
            <CardTitle>
              {d.code} · {d.title}
            </CardTitle>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <Badge>{label(d.kind)}</Badge>
              <Badge variant={variant}>{txt}</Badge>
              {d.current && (
                <span className="text-muted-foreground">
                  v{d.current.version} · vigente desde{" "}
                  {d.current.effectiveFrom ? formatDate(d.current.effectiveFrom) : "—"}
                  {d.current.nextReviewOn
                    ? ` · revisar antes de ${formatDate(d.current.nextReviewOn)}`
                    : ""}{" "}
                  · aprobó {d.current.approvedName}
                </span>
              )}
              {d.draft && <Badge variant="warning">Borrador v{d.draft.version}</Badge>}
            </p>
            {d.current && (
              <details className="mt-2">
                <summary className="text-primary min-h-11 cursor-pointer py-2">
                  Ver el documento vigente
                </summary>
                <p className="text-sm whitespace-pre-wrap">{d.current.body}</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Huella de evidencia: {d.current.evidenceHash?.slice(0, 16)}…
                </p>
              </details>
            )}
            {d.kind === "policy" && d.current && (
              <p className="mt-1 text-sm">
                Constancias de lectura de la versión vigente:{" "}
                <strong>{acks.get(d.current.id)?.length ?? 0}</strong>
              </p>
            )}
            {d.draft && canApprove && d.draft.createdBy !== ctx.user.id && (
              <FormModal
                title={`Aprobar el borrador v${d.draft!.version}`}
                trigger="Aprobar el borrador"
                triggerVariant="default"
                triggerClassName="mt-2"
                size="lg"
              >
                <p className="text-sm whitespace-pre-wrap">{d.draft.body}</p>
                <ActionForm
                  action={approveAction}
                  idPrefix={`ap-${d.id}-`}
                  hidden={{ id: d.draft.id, documentId: d.id }}
                  submit="Aprobar con mi firma"
                  fields={[
                    {
                      name: "effectiveFrom",
                      label: "Vigente desde",
                      type: "date",
                      saved: today,
                      required: true,
                    },
                    { name: "signature", label: "Firma de quien aprueba", type: "signature" },
                  ]}
                />
              </FormModal>
            )}
            {d.draft && canApprove && d.draft.createdBy === ctx.user.id && (
              <p className="text-muted-foreground mt-2 text-sm">
                Otra persona con permiso de aprobación debe aprobar tu borrador.
              </p>
            )}
            {edit && (
              <FormModal
                title={d.draft ? "Editar el borrador" : "Crear una nueva versión"}
                trigger={d.draft ? "Editar el borrador" : "Crear una nueva versión"}
                triggerClassName="mt-2"
                size="lg"
              >
                <ActionForm
                  action={draftAction}
                  idPrefix={`dr-${d.id}-`}
                  hidden={{ id: d.id }}
                  submit={d.draft ? "Guardar borrador" : "Crear nueva versión"}
                  fields={[
                    {
                      name: "body",
                      label: "Contenido",
                      type: "textarea",
                      rows: 8,
                      saved: (d.draft ?? d.current)?.body,
                    },
                    { name: "changeNote", label: "Qué cambió", saved: d.draft?.changeNote },
                  ]}
                />
              </FormModal>
            )}
            <details className="mt-1">
              <summary className="text-primary min-h-11 cursor-pointer py-2">
                Historial de versiones ({d.history.length})
              </summary>
              <ul className="text-sm">
                {d.history.map((v) => (
                  <li key={v.id} className="py-1">
                    v{v.version} ·{" "}
                    {v.status === "approved"
                      ? "vigente"
                      : v.status === "obsolete"
                        ? "obsoleta"
                        : "borrador"}{" "}
                    · {v.createdByName}
                    {v.approvedAt
                      ? ` · aprobó ${v.approvedName} el ${formatDate(v.approvedAt.toISOString().slice(0, 10))}`
                      : ""}
                    {v.changeNote ? ` — ${v.changeNote}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          </Card>
        );
      })}
      {docs.length === 0 && (
        <Card>
          <p className="text-muted-foreground text-sm">Aún no hay documentos.</p>
        </Card>
      )}
      {create && (
        <Card>
          <CardTitle>Nuevo documento</CardTitle>
          {templates.length > 0 && (
            <p className="text-muted-foreground mt-1 text-xs">
              Plantillas de la plataforma disponibles: {templates.map((x) => x.name).join(", ")}{" "}
              (copia su texto en el contenido).
            </p>
          )}
          <div className="mt-3">
            <FormModal
              title="Crear documento"
              trigger="Crear documento"
              triggerVariant="default"
              size="lg"
            >
              <ActionForm
                action={createDocumentAction}
                idPrefix="nd-"
                submit="Crear documento"
                fields={[
                  { name: "code", label: "Código (p. ej. POL-001)", required: true },
                  { name: "title", label: "Título", required: true },
                  { name: "kind", label: "Tipo", type: "select", options: [...KINDS] },
                  { name: "ownerName", label: "Responsable" },
                  {
                    name: "reviewMonths",
                    label: "Revisar cada (meses; vacío = parámetro por defecto)",
                    type: "number",
                  },
                  { name: "body", label: "Contenido", type: "textarea", rows: 8 },
                ]}
              />
            </FormModal>
          </div>
        </Card>
      )}
    </div>
  );
}
