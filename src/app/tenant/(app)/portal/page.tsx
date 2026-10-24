import Link from "@/components/ui/link";
import { RunButton } from "@/components/forms/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/core/auth/session";
import { formatDate } from "@/lib/format";
import { portalFor } from "@/modules/portal/service";
import { consentStatus } from "@/modules/privacy/service";
import { acknowledgePolicyAction } from "./actions";

export const metadata = { title: "Mi portal" };
const STATE: Record<string, ["success" | "warning" | "destructive" | "default", string]> = {
  vigente: ["success", "Al día"],
  por_vencer: ["warning", "Por vencer"],
  vencida: ["destructive", "Vencida"],
  pendiente: ["warning", "Pendiente"],
  sin_formacion: ["destructive", "Sin realizar"],
};

export default async function PortalPage() {
  const ctx = await requireTenantMember();
  const [p, consent] = await Promise.all([
    portalFor(ctx.tenant.tenantId, { id: ctx.user.id, email: ctx.user.email }),
    consentStatus(ctx.tenant.tenantId, ctx.user.id),
  ]);
  const pending: string[] = [];
  if (p.policy?.current && !p.policyAcked) pending.push("Leer y aceptar la política de SST");
  if (!consent.accepted) pending.push("Autorizar el tratamiento de tus datos personales");
  for (const r of p.required.filter((x) => x.state !== "vigente"))
    pending.push(`Capacitación: ${r.courseName}`);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Mi portal</h1>
      {!p.worker && (
        <Alert variant="warning">
          Tu usuario no está vinculado a una persona registrada en la empresa (el correo de tu ficha
          debe coincidir con el de tu cuenta). Pide al responsable del SG-SST que lo actualice.
          Mientras tanto puedes leer la política y hacer reportes.
        </Alert>
      )}
      {!consent.accepted && (
        <Alert variant="warning">
          Falta tu autorización de tratamiento de datos.{" "}
          <Link href="/privacidad" className="underline">
            Revisar y autorizar
          </Link>
        </Alert>
      )}
      <Card>
        <CardTitle>Pendientes</CardTitle>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {pending.map((x) => (
            <li key={x}>{x}</li>
          ))}
          {pending.length === 0 && <li className="list-none">No tienes pendientes. ¡Gracias!</li>}
        </ul>
      </Card>
      <Card>
        <CardTitle>Política de seguridad y salud en el trabajo</CardTitle>
        {p.policy?.current ? (
          <div className="mt-2 space-y-2 text-sm">
            <p className="text-muted-foreground">
              Versión {p.policy.current.version} · vigente desde{" "}
              {p.policy.current.effectiveFrom ? formatDate(p.policy.current.effectiveFrom) : "—"}
            </p>
            <p className="whitespace-pre-wrap">{p.policy.current.body}</p>
            {p.policyAcked ? (
              <Badge variant="success">Ya registraste tu lectura</Badge>
            ) : (
              <RunButton
                action={acknowledgePolicyAction}
                arg={p.policy.current.id}
                variant="default"
              >
                Leí y acepto la política
              </RunButton>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">
            La empresa aún no ha publicado su política.
          </p>
        )}
      </Card>
      {p.worker && (
        <>
          <Card>
            <CardTitle>Mis capacitaciones</CardTitle>
            {p.required.length > 0 && (
              <ul className="mt-2 divide-y text-sm">
                {p.required.map((r) => {
                  const [v, txt] = STATE[r.state] ?? ["default", r.state];
                  return (
                    <li key={r.courseId} className="flex flex-wrap items-center gap-2 py-2">
                      <Badge variant={v}>{txt}</Badge> {r.courseName}
                      {r.dueDate && (
                        <span className="text-muted-foreground">vence {formatDate(r.dueDate)}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <ul className="mt-2 divide-y text-sm">
              {p.trainings.map((t, i) => (
                <li key={i} className="py-2">
                  {formatDate(t.date)} · {t.course}
                  {t.score !== null ? ` · nota ${t.score}` : ""}{" "}
                  {t.passed === false && <Badge variant="destructive">No aprobó</Badge>}
                </li>
              ))}
              {p.trainings.length === 0 && (
                <li className="text-muted-foreground py-2">
                  Aún no registras asistencia a capacitaciones.
                </li>
              )}
            </ul>
          </Card>
          <Card>
            <CardTitle>Mis elementos de protección personal</CardTitle>
            <ul className="mt-2 divide-y text-sm">
              {p.ppe.map((e, i) => (
                <li key={i} className="py-2">
                  {e.quantity} × {e.item}
                  {e.size ? ` (talla ${e.size})` : ""} · entregado {formatDate(e.deliveredAt)}
                  {e.dueDate ? ` · reposición ${formatDate(e.dueDate)}` : ""}
                </li>
              ))}
              {p.ppe.length === 0 && (
                <li className="text-muted-foreground py-2">Sin entregas registradas.</li>
              )}
            </ul>
          </Card>
          <Card>
            <CardTitle>Mis evaluaciones médicas ocupacionales</CardTitle>
            <ul className="mt-2 divide-y text-sm">
              {p.evaluations.map((e, i) => (
                <li key={i} className="py-2">
                  {e.type} ·{" "}
                  {e.status === "done"
                    ? `realizada ${e.performedDate ? formatDate(e.performedDate) : ""}`
                    : `programada ${e.scheduledDate ? formatDate(e.scheduledDate) : "—"}`}
                  {e.nextDueDate ? ` · próxima ${formatDate(e.nextDueDate)}` : ""}
                </li>
              ))}
              {p.evaluations.length === 0 && (
                <li className="text-muted-foreground py-2">Sin evaluaciones registradas.</li>
              )}
            </ul>
            <p className="text-muted-foreground mt-2 text-xs">
              El concepto y las recomendaciones médicas se consultan directamente con la IPS.
            </p>
          </Card>
        </>
      )}
      <Card>
        <CardTitle>Mis reportes</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {p.reports.map((r) => (
            <li key={r.id} className="py-2">
              {r.description.slice(0, 100)} ·{" "}
              {r.status === "new"
                ? "en revisión"
                : r.status === "actioned"
                  ? "con acción"
                  : "descartado"}
            </li>
          ))}
          {p.reports.length === 0 && (
            <li className="text-muted-foreground py-2">Aún no has hecho reportes.</li>
          )}
        </ul>
        <p className="mt-2">
          <Link href="/reportes" className="text-primary inline-block min-h-11 py-2 underline">
            Reportar una condición o acto inseguro
          </Link>
        </p>
      </Card>
    </div>
  );
}
