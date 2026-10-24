import { Card, CardTitle } from "@/components/ui/card";
import { requireTenantMember } from "@/core/auth/session";
import { withTenant } from "@/core/db";
import { can, loadPermissions } from "@/core/rbac/can";
import { REPORTS } from "@/modules/reports/builders";

export const metadata = { title: "Informes y exportaciones" };
const PHVA = ["1-Planear", "2-Hacer", "3-Verificar", "4-Actuar"] as const;
const PHVA_LABEL: Record<string, string> = {
  "1-Planear": "Planear",
  "2-Hacer": "Hacer",
  "3-Verificar": "Verificar",
  "4-Actuar": "Actuar",
};
const btn = "inline-flex min-h-11 items-center rounded-md border px-3 py-2 text-sm";

export default async function ReportsPage({ searchParams }: PageProps<"/tenant/informes">) {
  const ctx = await requireTenantMember();
  const perms = await withTenant({ tenantId: ctx.tenant.tenantId }, (tx) =>
    loadPermissions(tx, ctx.roleId),
  );
  const sp = await searchParams;
  const now = new Date().getUTCFullYear();
  const y = Number(sp.year);
  const year = Number.isInteger(y) && y > 2000 && y < 2100 ? y : now;
  const mine = REPORTS.filter((r) => can(perms, r.module, "view"));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Informes y exportaciones</h1>
      <nav className="flex flex-wrap items-center gap-2" aria-label="Año">
        {[now - 2, now - 1, now].map((v) => (
          <a
            key={v}
            href={`/informes?year=${v}`}
            className={`${btn} ${v === year ? "bg-primary text-primary-foreground" : ""}`}
          >
            {v}
          </a>
        ))}
      </nav>
      {can(perms, "reports", "view") && (
        <Card>
          <CardTitle>Carpeta de inspección</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            ZIP con un índice en PDF y todos los informes, documentos vigentes e investigaciones de{" "}
            {year}, organizados por ciclo PHVA, con la huella de cada archivo. Para entregar al
            inspector del Ministerio del Trabajo o a la ARL.
          </p>
          <p className="mt-2">
            <a href={`/informes/carpeta-inspeccion?year=${year}`} className={btn}>
              Descargar la carpeta de inspección {year}
            </a>
          </p>
        </Card>
      )}
      {PHVA.map((p) => {
        const list = mine.filter((r) => r.phva === p);
        if (!list.length) return null;
        return (
          <Card key={p}>
            <CardTitle>{PHVA_LABEL[p]}</CardTitle>
            <ul className="mt-2 divide-y text-sm">
              {list.map((r) => (
                <li key={r.id} className="space-y-2 py-3">
                  <p className="font-semibold">{r.title}</p>
                  <p className="text-muted-foreground">{r.description}</p>
                  <p className="flex flex-wrap gap-2">
                    {(["pdf", "xlsx", "csv"] as const).map((f) => (
                      <a key={f} href={`/informes/${r.id}/${f}?year=${year}`} className={btn}>
                        {f === "xlsx" ? "Excel" : f.toUpperCase()}
                      </a>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
      {ctx.roleKey === "ADMIN_EMPRESA" && (
        <Card>
          <CardTitle>Exportación total de los datos</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            ZIP con un CSV por tabla (portabilidad de datos y cierre de cuenta). No incluye
            contenido cifrado de salud ni quejas, firmas ni credenciales.
          </p>
          <p className="mt-2">
            <a href="/informes/exportacion-total" className={btn}>
              Descargar todos los datos
            </a>
          </p>
        </Card>
      )}
    </div>
  );
}
