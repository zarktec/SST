import Link from "@/components/ui/link";
import { RunButton } from "@/components/forms/action-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/core/auth/session";
import { withTenant } from "@/core/db";
import { loadPermissions, permissionList } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { listForUser, pushConfigured, vapidPublicKey } from "@/modules/notifications/service";
import { markAllReadAction, markOneReadAction } from "./actions";
import { PushToggle } from "./push-toggle";

export const metadata = { title: "Alertas" };
const SEV = {
  critical: ["destructive", "Crítica"],
  warning: ["warning", "Atención"],
  info: ["default", "Info"],
} as const;

export default async function NotificationsPage() {
  const ctx = await requireTenantMember();
  const perms = permissionList(
    await withTenant({ tenantId: ctx.tenant.tenantId }, (tx) => loadPermissions(tx, ctx.roleId)),
  );
  const items = await listForUser(ctx.tenant.tenantId, ctx.user.id, perms);
  const unread = items.filter((i) => !i.read).length;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Alertas</h1>
      <nav className="flex gap-2">
        <Link href="/calendario" className="min-h-11 rounded-md border px-3 py-2 text-sm">
          Calendario de obligaciones
        </Link>
      </nav>
      <Card>
        <CardTitle>Notificaciones en este dispositivo</CardTitle>
        <div className="mt-2">
          <PushToggle publicKey={pushConfigured() ? vapidPublicKey() : ""} />
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Recibes un correo con las alertas nuevas y un resumen semanal (lunes) si eres el
          responsable del SG-SST o administrador.
        </p>
      </Card>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Alertas abiertas ({items.length})</CardTitle>
          {unread > 0 && (
            <RunButton action={markAllReadAction} arg="">
              Marcar todas como leídas
            </RunButton>
          )}
        </div>
        <ul className="mt-2 divide-y text-sm">
          {items.map((n) => {
            const [variant, txt] = SEV[n.severity as keyof typeof SEV];
            return (
              <li
                key={n.id}
                className={`flex flex-wrap items-start justify-between gap-2 py-3 ${n.read ? "opacity-70" : ""}`}
              >
                <div>
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge variant={variant}>{txt}</Badge>
                    {n.href ? (
                      <Link href={n.href} className="font-semibold underline">
                        {n.title}
                      </Link>
                    ) : (
                      <span className="font-semibold">{n.title}</span>
                    )}
                    {!n.read && <Badge variant="warning">Nueva</Badge>}
                  </p>
                  {n.detail && <p className="text-muted-foreground">{n.detail}</p>}
                  <p className="text-muted-foreground text-xs">
                    Desde {formatDate(n.firstSeenAt.toISOString().slice(0, 10))}
                    {n.dueOn ? ` · vence ${formatDate(n.dueOn)}` : ""}
                  </p>
                </div>
                {!n.read && (
                  <RunButton action={markOneReadAction} arg={n.id}>
                    Marcar leída
                  </RunButton>
                )}
              </li>
            );
          })}
          {items.length === 0 && (
            <li className="text-muted-foreground py-2">No hay alertas abiertas. ¡Todo al día!</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
