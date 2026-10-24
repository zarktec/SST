import Link, { A } from "@/components/ui/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { Pager } from "@/components/ui/pager";
import { formatDate } from "@/lib/format";
import { parsePage } from "@/lib/pagination";
import { IMPORT_TEMPLATE, KINDS, isActive } from "@/modules/workers/rules";
import {
  contractorStatuses,
  countWorkers,
  listCenters,
  listWorkers,
  type WorkerFilters,
} from "@/modules/workers/service";
import { todayYmd } from "@/lib/dates";
import { FormModal } from "@/components/ui/modal";
import { ImportForm } from "./import-form";
import { WorkerForm } from "./worker-form";

export const metadata = { title: "Personas" };
const sel = "border-input bg-background min-h-11 rounded-md border px-3 text-base";
const SS = {
  al_dia: ["success", "Al día"],
  pendiente: ["warning", "Pendiente"],
  vencida: ["destructive", "Vencida"],
} as const;

export default async function PeoplePage({ searchParams }: PageProps<"/tenant/personas">) {
  const ctx = await requirePermission("workers", "view");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const status =
    one("estado") === "retired" ? "retired" : one("estado") === "all" ? undefined : "active";
  const pg = parsePage(sp);
  const filters: WorkerFilters = { q: one("q"), kind: one("tipo"), centerId: one("sede"), status };
  const [people, total, centers, contractors] = await Promise.all([
    listWorkers(ctx.tenant.tenantId, { ...filters, limit: pg.limit, offset: pg.offset }),
    countWorkers(ctx.tenant.tenantId, filters),
    listCenters(ctx.tenant.tenantId),
    contractorStatuses(ctx.tenant.tenantId),
  ]);
  const centerName = new Map(centers.map((c) => [c.id, c.name]));
  const canCreate = can(ctx.permissions, "workers", "create");
  const today = todayYmd();
  const pendingSs = contractors.filter((c) => c.state !== "al_dia");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Personas</h1>
        {canCreate && (
          <div className="flex flex-wrap gap-2">
            <FormModal
              title="Registrar persona"
              trigger="Registrar"
              triggerVariant="default"
              size="lg"
            >
              <WorkerForm centers={centers} />
            </FormModal>
            <FormModal
              title="Carga masiva de personas"
              trigger="Carga masiva"
              description="Sube un CSV con la plantilla; el reporte indica qué filas se omitieron o tienen error."
            >
              <div className="mb-4 space-y-1 text-sm">
                <p>
                  <A className="text-primary underline" href="/personas/plantilla">
                    Descargar plantilla-personas.csv
                  </A>
                </p>
                <p className="text-muted-foreground">
                  Obligatorias: vinculacion (Trabajador, Aprendiz o Contratista), tipo_documento
                  (CC, CE, TI, PEP, pasaporte), documento, nombre y fecha_ingreso (AAAA-MM-DD o
                  DD/MM/AAAA). La sede se escribe con el mismo nombre registrado.
                </p>
                <p className="text-muted-foreground text-xs break-all">
                  Columnas: {IMPORT_TEMPLATE}
                </p>
              </div>
              <ImportForm />
            </FormModal>
          </div>
        )}
      </div>

      {pendingSs.length > 0 && (
        <Card>
          <CardTitle>Seguridad social de contratistas ({pendingSs[0].duePeriod})</CardTitle>
          <ul className="mt-2 divide-y text-sm">
            {pendingSs.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/personas/${c.id}`} className="underline">
                  {c.fullName}
                  {c.contractorCompany ? ` · ${c.contractorCompany}` : ""}
                </Link>
                <Badge variant={SS[c.state][0]}>{SS[c.state][1]}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <form className="flex flex-wrap items-end gap-2" role="search">
        <Input
          name="q"
          defaultValue={one("q")}
          placeholder="Nombre, cargo o documento"
          aria-label="Buscar"
          className="max-w-xs"
        />
        <select
          name="tipo"
          defaultValue={one("tipo") ?? ""}
          className={sel}
          aria-label="Vinculación"
        >
          <option value="">Todas las vinculaciones</option>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
        <select name="sede" defaultValue={one("sede") ?? ""} className={sel} aria-label="Sede">
          <option value="">Todas las sedes</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="estado"
          defaultValue={one("estado") ?? "active"}
          className={sel}
          aria-label="Estado"
        >
          <option value="active">Activos</option>
          <option value="retired">Retirados</option>
          <option value="all">Todos</option>
        </select>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      <Card>
        {people.length === 0 ? (
          <p className="text-muted-foreground text-sm">No hay personas con esos filtros.</p>
        ) : (
          <ul className="divide-y">
            {people.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/personas/${p.id}`}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <span>
                    <span className="font-semibold">{p.fullName}</span>
                    <span className="text-muted-foreground block">
                      {[p.position, p.area, p.workCenterId ? centerName.get(p.workCenterId) : null]
                        .filter(Boolean)
                        .join(" · ") || "—"}{" "}
                      · doc. ••••{p.idLast4}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge>{KINDS.find((k) => k.value === p.kind)?.label}</Badge>
                    {!isActive(p, today) && (
                      <Badge variant="warning">Retirado {formatDate(p.endDate)}</Badge>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pager
          base="/personas"
          params={{ q: one("q"), tipo: one("tipo"), sede: one("sede"), estado: one("estado") }}
          page={pg.page}
          total={total}
          size={pg.size}
        />
      </Card>
    </div>
  );
}
