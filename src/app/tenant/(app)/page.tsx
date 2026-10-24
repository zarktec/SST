import Link from "@/components/ui/link";
import { Alert } from "@/components/ui/alert";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { tp } from "@/core/tenancy/base-path";
import { requireTenantMember } from "@/core/auth/session";
import { withTenant } from "@/core/db";
import { can, loadPermissions } from "@/core/rbac/can";
import { unevaluatedCount } from "@/modules/legal/service";
import { assessmentReminderFor } from "@/modules/assessment/service";
import { getOnboardingState, openAlerts } from "@/modules/company/service";
import { ResolveAlertButton } from "./onboarding/forms";
import { permissionList } from "@/core/rbac/can";
import { unreadCount } from "@/modules/notifications/service";

export const metadata = { title: "Inicio" };

export default async function TenantHome() {
  const ctx = await requireTenantMember();
  const perms = await withTenant({ tenantId: ctx.tenant.tenantId }, (tx) =>
    loadPermissions(tx, ctx.roleId),
  );
  const canSetup = can(perms, "company", "edit");
  const reminder = await assessmentReminderFor(ctx.tenant.tenantId);
  const legalPending = can(perms, "legal_matrix", "view")
    ? await unevaluatedCount(ctx.tenant.tenantId)
    : 0;
  const [state, alerts] = await Promise.all([
    getOnboardingState(ctx.tenant.tenantId),
    openAlerts(ctx.tenant.tenantId),
  ]);
  const pending = canSetup && !state.tenant.onboardingCompletedAt;
  const unread = await unreadCount(ctx.tenant.tenantId, ctx.user.id, permissionList(perms)).catch(
    () => 0,
  );
  const searchAction = await tp("/buscar");
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Hola, {ctx.user.name.split(" ")[0]}</h1>
      {(canSetup ? alerts : []).map((a) => (
        <Alert
          key={a.id}
          variant="warning"
          className="flex flex-wrap items-center justify-between gap-2"
        >
          <span>{a.message}</span>
          <ResolveAlertButton id={a.id} />
        </Alert>
      ))}
      {reminder && can(perms, "standards", "view") && (
        <Alert variant="warning">
          {reminder === "aplicar"
            ? "Es momento de aplicar la autoevaluación de estándares mínimos. "
            : "Recuerda registrar la autoevaluación ante el Ministerio del Trabajo. "}
          <Link href="/estandares" className="underline">
            Ir a Estándares
          </Link>
        </Alert>
      )}
      {legalPending > 0 && (
        <Alert variant="warning">
          Hay {legalPending} normas o requisitos sin evaluar en tu matriz legal.{" "}
          <Link href="/matriz-legal" className="underline">
            Revisar matriz legal
          </Link>
        </Alert>
      )}
      {pending && (
        <Card>
          <CardTitle>Configura tu SG-SST</CardTitle>
          <CardDescription className="mt-1">
            Completa los datos de la empresa, sedes y responsable para clasificar tus estándares
            mínimos.
          </CardDescription>
          <Link
            href="/onboarding"
            className="text-primary mt-2 inline-block min-h-11 py-2 underline"
          >
            Continuar con el onboarding
          </Link>
        </Card>
      )}
      {unread > 0 && (
        <Alert variant="warning">
          Tienes {unread} alerta(s) sin leer.{" "}
          <Link href="/notificaciones" className="underline">
            Ver alertas
          </Link>
        </Alert>
      )}
      <form action={searchAction} role="search" className="flex gap-2">
        <input
          type="search"
          name="q"
          aria-label="Buscar"
          placeholder="Buscar personas, documentos, acciones…"
          className="border-input bg-background min-h-11 w-full rounded-md border px-3 text-base"
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground min-h-11 rounded-md px-4 text-sm font-medium"
        >
          Buscar
        </button>
      </form>
      <Card>
        <CardTitle>Bienvenido a {ctx.tenant.tradeName}</CardTitle>
        <CardDescription className="mt-1">
          Rol: {ctx.roleKey ?? "personalizado"}.
          {state.tenant.standardsGroup
            ? ` Te aplican ${state.tenant.standardsGroup} estándares mínimos.`
            : ""}
        </CardDescription>
      </Card>
      <Card>
        <CardTitle>Módulos</CardTitle>
        <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          {[
            ["/estandares", "Estándares mínimos", "standards"],
            ["/matriz-legal", "Matriz legal", "legal_matrix"],
            ["/peligros", "Matriz de peligros", "hazard_matrix"],
            ["/plan-anual", "Plan anual de trabajo", "annual_plan"],
            ["/personas", "Personas", "workers"],
            ["/capacitacion", "Capacitación", "training"],
            ["/epp", "EPP", "ppe"],
            ["/comites", "Comités", "committees"],
            ["/medicina", "Medicina del trabajo", "medical"],
            ["/emergencias", "Emergencias", "emergencies"],
            ["/alto-riesgo", "Tareas de alto riesgo", "high_risk"],
            ["/quimicos", "Riesgo químico", "chemicals"],
            ["/pesv", "PESV (seguridad vial)", "pesv"],
            ["/vigilancia", "Vigilancia epidemiológica y psicosocial", "medical"],
            ["/auditorias", "Auditoría interna", "audits"],
            ["/revision-direccion", "Revisión por la dirección", "management_review"],
            ["/documentos", "Documentos y política", "documents"],
            ["/acciones", "Acciones (CAPA)", "actions"],
            ["/accidentes", "Accidentes e incidentes", "incidents"],
            ["/reportes", "Condiciones y actos inseguros", "unsafe_reports"],
            ["/inspecciones", "Inspecciones", "inspections"],
            ["/indicadores", "Indicadores", "indicators"],
            ["/convivencia", "Convivencia laboral", "ccl"],
            ["/acoso-sexual", "Acoso sexual", "harassment"],
          ]
            .filter(([, , m]) => can(perms, m as never, "view"))
            .map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="text-primary inline-block min-h-11 py-2 underline">
                  {label}
                </Link>
              </li>
            ))}
        </ul>
      </Card>
      <p className="text-sm">
        <Link href="/notificaciones" className="text-primary inline-block min-h-11 py-2 underline">
          Alertas
        </Link>
        {" · "}
        <Link href="/calendario" className="text-primary inline-block min-h-11 py-2 underline">
          Calendario de obligaciones
        </Link>
        {" · "}
        <Link href="/informes" className="text-primary inline-block min-h-11 py-2 underline">
          Informes y exportaciones
        </Link>
        {" · "}
        <Link href="/portal" className="text-primary inline-block min-h-11 py-2 underline">
          Mi portal
        </Link>
        {" · "}
        <Link href="/privacidad" className="text-primary inline-block min-h-11 py-2 underline">
          Privacidad
        </Link>
        {" · "}
        <Link
          href="/convivencia/radicar"
          className="text-primary inline-block min-h-11 py-2 underline"
        >
          Radicar una queja de convivencia
        </Link>
        {" · "}
        <Link
          href="/acoso-sexual/radicar"
          className="text-primary inline-block min-h-11 py-2 underline"
        >
          Reportar acoso sexual o violencia de género
        </Link>
      </p>
      {ctx.roleKey === "ADMIN_EMPRESA" && (
        <p className="text-sm">
          <Link href="/facturacion" className="text-primary inline-block min-h-11 py-2 underline">
            Ir a Facturación (plan, pagos y facturas)
          </Link>
          {" · "}
          <Link href="/dominio" className="text-primary inline-block min-h-11 py-2 underline">
            Dominio propio
          </Link>
        </p>
      )}
    </div>
  );
}
