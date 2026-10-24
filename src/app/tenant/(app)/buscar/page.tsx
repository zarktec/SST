import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/core/auth/session";
import { withTenant } from "@/core/db";
import { loadPermissions, permissionList } from "@/core/rbac/can";
import { searchAll } from "@/modules/search/service";

export const metadata = { title: "Buscar" };

export default async function SearchPage({ searchParams }: PageProps<"/tenant/buscar">) {
  const ctx = await requireTenantMember();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const perms = permissionList(
    await withTenant({ tenantId: ctx.tenant.tenantId }, (tx) => loadPermissions(tx, ctx.roleId)),
  );
  const hits = await searchAll(ctx.tenant.tenantId, q, perms);
  const groups = [...new Set(hits.map((h) => h.group))];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Buscar</h1>
      <form action="/buscar" role="search" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Buscar"
          placeholder="Personas, documentos, acciones, eventos, sustancias, vehículos…"
          className="border-input bg-background min-h-11 w-full rounded-md border px-3 text-base"
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground min-h-11 rounded-md px-4 text-sm font-medium"
        >
          Buscar
        </button>
      </form>
      {q.trim().length >= 2 && hits.length === 0 && (
        <Card>
          <p className="text-muted-foreground text-sm">Sin resultados para «{q}».</p>
        </Card>
      )}
      {groups.map((g) => (
        <Card key={g}>
          <CardTitle>{g}</CardTitle>
          <ul className="mt-2 divide-y text-sm">
            {hits
              .filter((h) => h.group === g)
              .map((h, i) => (
                <li key={i}>
                  <Link href={h.href} className="block min-h-11 py-2">
                    <span className="font-semibold underline">{h.title}</span>
                    {h.detail && <span className="text-muted-foreground block">{h.detail}</span>}
                  </Link>
                </li>
              ))}
          </ul>
        </Card>
      ))}
      <p className="text-muted-foreground text-xs">
        No se busca en datos de salud ni en quejas. Los resultados dependen de tus permisos.
      </p>
    </div>
  );
}
