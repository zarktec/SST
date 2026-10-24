import Link from "@/components/ui/link";
import { ActionForm } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { todayYmd } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { PSY_LEVELS } from "@/modules/pve/rules";
import { listPsychosocial } from "@/modules/pve/service";
import { psychosocialAction } from "../actions";

export const metadata = { title: "Riesgo psicosocial" };
const STATE = {
  al_dia: ["success", "Al día"],
  por_vencer: ["warning", "Por vencer"],
  vencida: ["destructive", "Vencida"],
  sin_aplicar: ["default", "Sin aplicar"],
} as const;

export default async function PsychosocialPage() {
  const ctx = await requirePermission("medical", "view");
  const create = can(ctx.permissions, "medical", "create");
  const { assessments, state, nextDueOn } = await listPsychosocial(ctx.tenant.tenantId);
  const [variant, txt] = STATE[state];
  return (
    <div className="space-y-4">
      <Link href="/vigilancia" className="text-primary text-sm underline">
        ← Vigilancia epidemiológica
      </Link>
      <h1 className="text-2xl font-bold">Riesgo psicosocial</h1>
      <Alert>
        La plataforma no aplica la batería: registra quién la aplicó (psicólogo con licencia en
        seguridad y salud en el trabajo), cuándo y el nivel de riesgo resultante, programa la
        siguiente y convierte el plan de intervención en acciones.
      </Alert>
      <Card>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          Próxima aplicación: <Badge variant={variant}>{txt}</Badge>
          {nextDueOn && <strong>{formatDate(nextDueOn)}</strong>}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Anual si el riesgo es alto o muy alto; cada 2 años si es medio, bajo o nulo
          (parametrizable).
        </p>
      </Card>
      {create && (
        <Card>
          <CardTitle>Registrar una aplicación</CardTitle>
          <div className="mt-3">
            <ActionForm
              action={psychosocialAction}
              idPrefix="ps-"
              submit="Registrar aplicación"
              fields={[
                {
                  name: "appliedOn",
                  label: "Fecha de aplicación",
                  type: "date",
                  saved: todayYmd(),
                  required: true,
                },
                { name: "psychologistName", label: "Psicólogo(a)", required: true },
                {
                  name: "licenseNumber",
                  label: "Licencia en seguridad y salud en el trabajo",
                  required: true,
                },
                {
                  name: "riskLevel",
                  label: "Nivel de riesgo resultante",
                  type: "select",
                  options: [...PSY_LEVELS],
                  saved: "medium",
                },
                { name: "scope", label: "Población evaluada" },
                { name: "responsibleName", label: "Responsable del plan de intervención" },
                {
                  name: "interventions",
                  label: "Plan de intervención (una acción por línea; cada una crea una acción)",
                  type: "textarea",
                },
                { name: "notes", label: "Observaciones", type: "textarea" },
              ]}
            />
          </div>
        </Card>
      )}
      <Card>
        <CardTitle>Historial</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {assessments.map((a) => (
            <li key={a.id} className="py-2">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{formatDate(a.appliedOn)}</span>
                <Badge
                  variant={
                    a.riskLevel === "high" || a.riskLevel === "very_high"
                      ? "destructive"
                      : a.riskLevel === "medium"
                        ? "warning"
                        : "success"
                  }
                >
                  {PSY_LEVELS.find((l) => l.value === a.riskLevel)?.label}
                </Badge>
                <span className="text-muted-foreground">
                  {a.psychologistName} · licencia {a.licenseNumber}
                </span>
              </p>
              {a.scope && <p>{a.scope}</p>}
            </li>
          ))}
          {assessments.length === 0 && (
            <li className="text-muted-foreground py-2">Sin aplicaciones registradas.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
