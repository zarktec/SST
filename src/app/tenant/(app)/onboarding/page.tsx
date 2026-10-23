import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { getOnboardingState } from "@/modules/company/service";
import {
  BrandForm,
  CenterForm,
  CompanyForm,
  CompleteButton,
  RemoveCenter,
  ResponsibleForm,
} from "./forms";

export const metadata = { title: "Onboarding" };

const STEPS = [
  { n: 1, key: "company", label: "Empresa" },
  { n: 2, key: "centers", label: "Sedes" },
  { n: 3, key: "responsible", label: "Responsable SG-SST" },
  { n: 4, key: "brand", label: "Marca" },
  { n: 5, key: "summary", label: "Resumen" },
] as const;
const REFRESHER = {
  vigente: "Vigente",
  por_vencer: "Por vencer",
  vencida: "Vencida",
  sin_datos: "Sin datos",
} as const;

export default async function Onboarding({ searchParams }: PageProps<"/tenant/onboarding">) {
  const ctx = await requirePermission("company", "view");
  const sp = await searchParams;
  const step = Math.min(5, Math.max(1, Number(sp.paso) || 1));
  const st = await getOnboardingState(ctx.tenant.tenantId);
  const canEdit = can(ctx.permissions, "company", "edit");
  const { tenant: t } = st;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Configura tu SG-SST</h1>
      <nav aria-label="Pasos" className="flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <Link
            key={s.n}
            href={`/onboarding?paso=${s.n}`}
            aria-current={s.n === step ? "step" : undefined}
            className={`min-h-11 rounded-md border px-3 py-2 text-sm ${s.n === step ? "bg-primary text-primary-foreground" : ""}`}
          >
            {s.n}. {s.label}
            {s.key !== "summary" && st.steps[s.key] ? " ✓" : ""}
          </Link>
        ))}
      </nav>
      {!canEdit && <Alert>Tienes acceso de solo lectura a esta sección.</Alert>}

      {step === 1 && (
        <Card>
          <CardTitle>Datos de la empresa</CardTitle>
          <CardDescription className="mt-1">
            Con el número de trabajadores y la clase de riesgo determinamos cuántos estándares
            mínimos te aplican.
          </CardDescription>
          <div className="mt-3">
            <CompanyForm saved={{ ...t, updatedAt: undefined } as never} suggestedRisk={null} />
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardTitle>Sedes o centros de trabajo</CardTitle>
          {st.centers.length > 0 && (
            <ul className="mt-3 divide-y">
              {st.centers.map((c) => (
                <li key={c.id} className="space-y-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-semibold">
                      {c.name}{" "}
                      <span className="text-muted-foreground font-normal">
                        · riesgo {c.riskClass ?? "—"} · {c.workersCount} trabajadores
                      </span>
                    </span>
                    {canEdit && <RemoveCenter id={c.id} />}
                  </div>
                  {canEdit && (
                    <details>
                      <summary className="text-primary min-h-11 cursor-pointer py-2 text-sm">
                        Editar
                      </summary>
                      <CenterForm
                        center={
                          {
                            ...c,
                            createdAt: undefined,
                            updatedAt: undefined,
                            deletedAt: undefined,
                          } as never
                        }
                      />
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <div className="mt-4 border-t pt-4">
              <h3 className="mb-2 text-sm font-semibold">Agregar sede</h3>
              <CenterForm />
            </div>
          )}
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardTitle>Responsable del SG-SST</CardTitle>
          {st.responsibleStatus && (
            <div className="mt-2 space-y-1 text-sm">
              <p>
                Actualización de 20 horas:{" "}
                <Badge
                  variant={
                    st.responsibleStatus.refresherState === "vigente"
                      ? "success"
                      : st.responsibleStatus.refresherState === "sin_datos"
                        ? "default"
                        : "warning"
                  }
                >
                  {REFRESHER[st.responsibleStatus.refresherState]}
                </Badge>{" "}
                {st.responsibleStatus.refresherDue &&
                  `(hasta ${formatDate(st.responsibleStatus.refresherDue)})`}
              </p>
              {st.responsibleStatus.issues.map((i) => (
                <Alert key={i} variant="warning">
                  {i}
                </Alert>
              ))}
            </div>
          )}
          <div className="mt-3">
            <ResponsibleForm
              saved={
                { ...(st.responsible ?? {}), createdAt: undefined, updatedAt: undefined } as never
              }
            />
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardTitle>Marca</CardTitle>
          <div className="mt-3">
            <BrandForm
              saved={
                { ...(st.brand ?? {}), contrastReport: undefined, updatedAt: undefined } as never
              }
            />
          </div>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardTitle>Resumen</CardTitle>
          <ul className="mt-3 space-y-1 text-sm">
            <li>
              Estándares mínimos aplicables: <strong>{t.standardsGroup ?? "sin clasificar"}</strong>
            </li>
            <li>
              Clase de riesgo efectiva: <strong>{st.effectiveRisk ?? "—"}</strong>
            </li>
            <li>
              Trabajadores declarados: <strong>{t.workersCount ?? "—"}</strong>
            </li>
            <li>
              Sedes: <strong>{st.centers.length}</strong>
            </li>
            <li>
              Responsable: <strong>{st.responsible?.fullName ?? "pendiente"}</strong>
            </li>
          </ul>
          <p className="text-muted-foreground mt-3 text-sm">
            Al finalizar podrás aplicar la autoevaluación de estándares mínimos; el plan de trabajo
            sugerido se genera con sus resultados.
          </p>
          {t.onboardingCompletedAt ? (
            <Alert variant="success" className="mt-3">
              Onboarding completado el {formatDate(t.onboardingCompletedAt)}.
            </Alert>
          ) : canEdit ? (
            <div className="mt-3">
              <CompleteButton disabled={!st.canComplete} />
              {!st.canComplete && (
                <p className="text-muted-foreground mt-2 text-sm">
                  Faltan pasos por completar (marcados sin ✓).
                </p>
              )}
            </div>
          ) : null}
        </Card>
      )}
    </div>
  );
}
