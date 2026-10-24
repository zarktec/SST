import { NavIcon } from "@/components/layout/app-shell";
import { MODULE_GROUPS, type NavItem } from "@/components/layout/nav-config";
import Link from "@/components/ui/link";
import { Alert } from "@/components/ui/alert";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
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

const QUICK: (NavItem & { module: string })[] = [
  {
    href: "/reportes",
    label: "Reportar una condición insegura",
    icon: "ShieldAlert",
    module: "unsafe_reports",
  },
  { href: "/acciones", label: "Acciones pendientes", icon: "Target", module: "actions" },
  {
    href: "/inspecciones",
    label: "Hacer una inspección",
    icon: "ListChecks",
    module: "inspections",
  },
  { href: "/accidentes", label: "Reportar un accidente", icon: "Siren", module: "incidents" },
];

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
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Hola, {ctx.user.name.split(" ")[0]}</h1>
        <p className="text-muted-foreground text-sm">
          {ctx.tenant.tradeName}
          {state.tenant.standardsGroup
            ? ` · te aplican ${state.tenant.standardsGroup} estándares mínimos`
            : ""}
        </p>
      </div>
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
      <section aria-label="Accesos rápidos" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK.filter((q) => can(perms, q.module as never, "view")).map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="bg-card hover:border-primary flex min-h-24 flex-col justify-between gap-2 rounded-xl border p-4 shadow-sm transition-colors"
          >
            <span className="bg-primary/10 text-brand-text grid size-9 place-items-center rounded-lg">
              <NavIcon name={q.icon} />
            </span>
            <span className="text-sm leading-tight font-semibold">{q.label}</span>
          </Link>
        ))}
      </section>
      {MODULE_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((i) => !i.module || can(perms, i.module as never, "view")),
      }))
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <section key={g.label} aria-labelledby={`g-${g.label}`} className="space-y-2">
            <h2 id={`g-${g.label}`} className="text-muted-foreground text-sm font-semibold">
              {g.label}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((i) => (
                <li key={i.href}>
                  <Link
                    href={i.href}
                    className="bg-card hover:border-primary flex min-h-16 items-center gap-3 rounded-xl border p-3 shadow-sm transition-colors"
                  >
                    <span className="bg-muted text-brand-text grid size-10 shrink-0 place-items-center rounded-lg">
                      <NavIcon name={i.icon} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{i.label}</span>
                      {i.hint && (
                        <span className="text-muted-foreground block truncate text-xs">
                          {i.hint}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      <p className="text-sm">
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
    </div>
  );
}
