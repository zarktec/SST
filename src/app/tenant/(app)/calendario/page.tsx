import Link, { A } from "@/components/ui/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/core/auth/session";
import { withTenant } from "@/core/db";
import { loadPermissions, permissionList } from "@/core/rbac/can";
import { todayYmd } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { calendarFor } from "@/modules/notifications/service";

export const metadata = { title: "Calendario de obligaciones" };
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export default async function CalendarPage() {
  const ctx = await requireTenantMember();
  const perms = permissionList(
    await withTenant({ tenantId: ctx.tenant.tenantId }, (tx) => loadPermissions(tx, ctx.roleId)),
  );
  const today = todayYmd();
  const all = await calendarFor(ctx.tenant.tenantId, perms);
  const overdue = all.filter((e) => e.date < today);
  const upcoming = all.filter((e) => e.date >= today);
  const byMonth = new Map<string, typeof upcoming>();
  for (const e of upcoming)
    byMonth.set(e.date.slice(0, 7), [...(byMonth.get(e.date.slice(0, 7)) ?? []), e]);
  return (
    <div className="space-y-4">
      <Link href="/notificaciones" className="text-primary text-sm underline">
        ← Alertas
      </Link>
      <h1 className="text-2xl font-bold">Calendario de obligaciones</h1>
      <p className="flex flex-wrap items-center gap-3 text-sm">
        <A href="/calendario/ics" className="min-h-11 rounded-md border px-3 py-2">
          Descargar .ics (Google Calendar, Outlook, Apple)
        </A>
        <span className="text-muted-foreground">
          En Google Calendar: Configuración → Importar y exportar → Importar.
        </span>
      </p>
      {overdue.length > 0 && (
        <Card>
          <CardTitle>Vencidas ({overdue.length})</CardTitle>
          <ul className="mt-2 divide-y text-sm">
            {overdue.map((e) => (
              <li key={e.uid} className="flex flex-wrap items-center gap-2 py-2">
                <Badge variant="destructive">{formatDate(e.date)}</Badge>
                {e.href ? (
                  <Link href={e.href} className="underline">
                    {e.title}
                  </Link>
                ) : (
                  e.title
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {[...byMonth.entries()].map(([m, list]) => (
        <Card key={m}>
          <CardTitle>
            {MONTHS[Number(m.slice(5, 7)) - 1]} {m.slice(0, 4)}
          </CardTitle>
          <ul className="mt-2 divide-y text-sm">
            {list.map((e) => (
              <li key={e.uid} className="flex flex-wrap items-center gap-2 py-2">
                <Badge>{formatDate(e.date)}</Badge>
                {e.href ? (
                  <Link href={e.href} className="underline">
                    {e.title}
                  </Link>
                ) : (
                  e.title
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}
      {all.length === 0 && (
        <Card>
          <p className="text-muted-foreground text-sm">No hay fechas próximas.</p>
        </Card>
      )}
    </div>
  );
}
