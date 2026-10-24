import { ActionForm, RunButton, type FieldSpec } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { todayYmd } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { PICTOGRAMS, SIGNAL_WORDS, compatibilityConflicts } from "@/modules/chemicals/rules";
import { listSubstances } from "@/modules/chemicals/service";
import { listWorkCenters } from "@/modules/company/service";
import { complianceAction, retireAction, substanceAction } from "./actions";
import { FormModal } from "@/components/ui/modal";

export const metadata = { title: "Riesgo químico" };

export default async function ChemicalsPage() {
  const ctx = await requirePermission("chemicals", "view");
  const t = ctx.tenant.tenantId;
  const create = can(ctx.permissions, "chemicals", "create");
  const edit = can(ctx.permissions, "chemicals", "edit");
  const today = todayYmd();
  const [subs, centers] = await Promise.all([listSubstances(t), listWorkCenters(t)]);
  const conflicts = compatibilityConflicts(subs);
  const fields = (s?: (typeof subs)[number]): FieldSpec[] => [
    { name: "name", label: "Nombre del producto", saved: s?.name, required: true },
    { name: "casNumber", label: "Número CAS", saved: s?.casNumber },
    { name: "supplier", label: "Proveedor", saved: s?.supplier },
    { name: "location", label: "Lugar de almacenamiento", saved: s?.location, required: true },
    { name: "quantity", label: "Cantidad", saved: s?.quantity },
    {
      name: "signalWord",
      label: "Palabra de advertencia",
      type: "select",
      options: [...SIGNAL_WORDS],
      saved: s?.signalWord,
    },
    ...(centers.length > 1
      ? [
          {
            name: "workCenterId",
            label: "Sede",
            type: "select" as const,
            options: centers.map((c) => ({ value: c.id, label: c.name })),
            empty: "—",
            saved: s?.workCenterId,
          },
        ]
      : []),
    { name: "sdsRevisedOn", label: "Fecha de la FDS", type: "date", saved: s?.sdsRevisedOn },
    {
      name: "labelCheckedOn",
      label: "Etiquetado verificado el",
      type: "date",
      saved: s?.labelCheckedOn,
    },
    {
      name: "hStatements",
      label: "Indicaciones de peligro (frases H)",
      type: "textarea",
      saved: s?.hStatements,
    },
    ...PICTOGRAMS.map((p) => ({
      name: `p_${p.value}`,
      label: `${p.value} · ${p.label}`,
      type: "checkbox" as const,
      saved: s?.pictograms.includes(p.value),
    })),
  ];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Riesgo químico (SGA)</h1>
      {conflicts.length > 0 && (
        <Alert variant="destructive">
          <p className="text-sm font-semibold">Almacenamiento incompatible (matriz provisional):</p>
          <ul className="list-disc pl-5 text-sm">
            {conflicts.map((c) => (
              <li key={`${c.location}-${c.a}-${c.b}`}>
                {c.location}: {c.a} y {c.b} ({c.reason})
              </li>
            ))}
          </ul>
        </Alert>
      )}
      <Card>
        <CardTitle>Inventario de sustancias</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {subs.map((s) => (
            <li key={s.id} className="space-y-2 py-3">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{s.name}</span>
                <span className="text-muted-foreground">
                  {s.location}
                  {s.quantity ? ` · ${s.quantity}` : ""}
                  {s.casNumber ? ` · CAS ${s.casNumber}` : ""}
                </span>
                {s.signalWord !== "none" && (
                  <Badge variant={s.signalWord === "danger" ? "destructive" : "warning"}>
                    {s.signalWord === "danger" ? "Peligro" : "Atención"}
                  </Badge>
                )}
              </p>
              <p className="flex flex-wrap gap-1">
                {s.pictograms.map((p) => (
                  <Badge key={p}>{PICTOGRAMS.find((x) => x.value === p)?.label ?? p}</Badge>
                ))}
              </p>
              <p className="text-muted-foreground">
                FDS: {s.sdsRevisedOn ? formatDate(s.sdsRevisedOn) : "—"} · Etiquetado:{" "}
                {s.labelCheckedOn ? formatDate(s.labelCheckedOn) : "sin verificar"}
              </p>
              {s.issues.length > 0 && (
                <p className="flex flex-wrap gap-1">
                  {s.issues.map((i) => (
                    <Badge key={i} variant="warning">
                      {i}
                    </Badge>
                  ))}
                </p>
              )}
              {edit && (
                <FormModal title="Editar o retirar" trigger="Editar o retirar">
                  <ActionForm
                    action={substanceAction}
                    idPrefix={`s-${s.id}-`}
                    hidden={{ id: s.id }}
                    submit="Guardar cambios"
                    fields={fields(s)}
                  />
                  <ActionForm
                    action={complianceAction}
                    idPrefix={`c-${s.id}-`}
                    hidden={{ id: s.id }}
                    submit="Registrar revisión"
                    variant="outline"
                    fields={[
                      {
                        name: "sdsRevisedOn",
                        label: "FDS revisada el",
                        type: "date",
                        saved: today,
                      },
                      {
                        name: "labelCheckedOn",
                        label: "Etiquetado verificado el",
                        type: "date",
                        saved: today,
                      },
                    ]}
                  />
                  <RunButton
                    action={retireAction}
                    arg={s.id}
                    confirm="¿Retirar esta sustancia del inventario?"
                  >
                    Retirar del inventario
                  </RunButton>
                </FormModal>
              )}
            </li>
          ))}
          {subs.length === 0 && (
            <li className="text-muted-foreground py-2">Sin sustancias registradas.</li>
          )}
        </ul>
      </Card>
      {create && (
        <Card>
          <CardTitle>Agregar sustancia</CardTitle>
          <div className="mt-3">
            <FormModal
              title="Agregar sustancia"
              trigger="Agregar sustancia"
              triggerVariant="default"
              size="lg"
            >
              <ActionForm
                action={substanceAction}
                idPrefix="ns-"
                submit="Agregar sustancia"
                fields={fields()}
              />
            </FormModal>
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Los archivos de la FDS y las fotos del etiquetado se podrán adjuntar cuando se habilite
            el almacenamiento.
          </p>
        </Card>
      )}
    </div>
  );
}
