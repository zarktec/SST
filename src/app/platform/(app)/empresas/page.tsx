import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { listPlans } from "@/modules/platform/plans/service";
import { listTenants } from "@/modules/platform/tenants/service";

export const metadata = { title: "Empresas" };

const STATUS = {
  trial: ["Prueba", "warning"],
  active: ["Activa", "success"],
  past_due: ["En mora", "destructive"],
  suspended: ["Suspendida", "destructive"],
  cancelled: ["Cancelada", "default"],
} as const;

export default async function TenantsPage({ searchParams }: PageProps<"/platform/empresas">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const planId = typeof sp.plan === "string" ? sp.plan : "";
  const page = Number(typeof sp.page === "string" ? sp.page : 1) || 1;
  const [{ rows, total, pageSize }, plans] = await Promise.all([
    listTenants({
      search: q || undefined,
      status: status || undefined,
      planId: planId || undefined,
      page,
    }),
    listPlans(),
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const qs = (p: number) =>
    `?${new URLSearchParams({ ...(q && { q }), ...(status && { status }), ...(planId && { plan: planId }), page: String(p) })}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">
          Empresas <span className="text-muted-foreground text-base font-normal">({total})</span>
        </h1>
        <Link href="/empresas/nueva" className={buttonVariants()}>
          Nueva empresa
        </Link>
      </div>
      <form className="grid gap-2 sm:grid-cols-[1fr_10rem_10rem_auto]">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, NIT o identificador"
          aria-label="Buscar"
        />
        <select
          name="status"
          defaultValue={status}
          aria-label="Estado"
          className="border-input bg-background min-h-11 rounded-md border px-3 text-base"
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS).map(([k, [label]]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="plan"
          defaultValue={planId}
          aria-label="Plan"
          className="border-input bg-background min-h-11 rounded-md border px-3 text-base"
        >
          <option value="">Todos los planes</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
      </form>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No hay empresas con esos filtros.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => (
            <li key={t.id}>
              <Link href={`/empresas/${t.id}`} className="block">
                <Card className="hover:bg-muted flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{t.tradeName}</p>
                    <p className="text-muted-foreground text-xs">
                      {t.slug} · {t.legalName}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant={STATUS[t.status][1]}>{STATUS[t.status][0]}</Badge>
                    <span>{t.planName ?? "—"}</span>
                    <span className="text-muted-foreground">{t.users} usuarios</span>
                    <span className="text-muted-foreground">
                      {t.status === "trial"
                        ? `prueba hasta ${formatDate(t.trialEndsAt)}`
                        : t.currentPeriodEnd
                          ? `hasta ${formatDate(t.currentPeriodEnd)}`
                          : ""}
                    </span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          {page > 1 ? (
            <Link href={qs(page - 1)} className={buttonVariants({ variant: "outline" })}>
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground text-sm">
            Página {page} de {pages}
          </span>
          {page < pages ? (
            <Link href={qs(page + 1)} className={buttonVariants({ variant: "outline" })}>
              Siguiente
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
