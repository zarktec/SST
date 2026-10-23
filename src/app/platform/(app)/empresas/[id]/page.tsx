import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { formatCOP, formatDate, formatDateTime } from "@/lib/format";
import { getTenantDetail } from "@/modules/platform/tenants/service";
import { Operations } from "./operations";

const STATUS = {
  trial: "Prueba",
  active: "Activa",
  past_due: "En mora",
  suspended: "Suspendida",
  cancelled: "Cancelada",
} as const;
const DOMAIN = {
  verified: ["Verificado", "success"],
  pending: ["Pendiente", "warning"],
  error: ["Error", "destructive"],
} as const;

export default async function TenantDetail({ params }: PageProps<"/platform/empresas/[id]">) {
  const { id } = await params;
  const d = await getTenantDetail(id);
  if (!d) notFound();
  const { tenant: t, subscription: s, plan, domains, users, events, price } = d;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t.tradeName}</h1>
        <p className="text-muted-foreground text-sm">
          {t.legalName}
          {t.nit ? ` · NIT ${t.nit}` : ""} · {t.slug}
        </p>
      </div>
      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle>Suscripción</CardTitle>
          <Badge>{STATUS[t.status]}</Badge>
        </div>
        {s && plan ? (
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            <dt className="text-muted-foreground">Plan</dt>
            <dd>
              {plan.name}
              {s.period ? ` · ${s.period === "monthly" ? "mensual" : "anual"}` : ""}
            </dd>
            <dt className="text-muted-foreground">Valor (con IVA)</dt>
            <dd>{price ? formatCOP(price.totalCents) : "Gratuito"}</dd>
            {s.trialEndsAt && (
              <>
                <dt className="text-muted-foreground">Fin de la prueba</dt>
                <dd>{formatDateTime(s.trialEndsAt)}</dd>
              </>
            )}
            {s.currentPeriodEnd && (
              <>
                <dt className="text-muted-foreground">Periodo hasta</dt>
                <dd>
                  {formatDate(s.currentPeriodEnd)}
                  {s.cancelAtPeriodEnd ? " (se cancela)" : ""}
                </dd>
              </>
            )}
            {s.graceEndsAt && (
              <>
                <dt className="text-muted-foreground">Gracia hasta</dt>
                <dd>{formatDateTime(s.graceEndsAt)}</dd>
              </>
            )}
            {t.retentionUntil && (
              <>
                <dt className="text-muted-foreground">Datos conservados hasta</dt>
                <dd>{formatDate(t.retentionUntil)}</dd>
              </>
            )}
            <dt className="text-muted-foreground">Usuarios activos</dt>
            <dd>{users}</dd>
          </dl>
        ) : (
          <p className="text-muted-foreground text-sm">Sin suscripción.</p>
        )}
      </Card>
      <Operations
        tenantId={t.id}
        status={t.status}
        cancelScheduled={Boolean(s?.cancelAtPeriodEnd)}
      />
      <Card>
        <CardTitle>Dominios</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {domains.map((dm) => (
            <li key={dm.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {dm.host}{" "}
                <span className="text-muted-foreground text-xs">
                  ({dm.kind === "custom" ? "propio" : "subdominio"})
                </span>
              </span>
              <Badge variant={DOMAIN[dm.status][1]}>{DOMAIN[dm.status][0]}</Badge>
              {dm.lastError && (
                <span className="text-destructive w-full text-xs">{dm.lastError}</span>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardTitle>Historial de la suscripción</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>
                {e.type}
                {e.toStatus && e.fromStatus !== e.toStatus ? ` → ${e.toStatus}` : ""}
              </span>
              <span className="text-muted-foreground">{formatDateTime(e.at)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
