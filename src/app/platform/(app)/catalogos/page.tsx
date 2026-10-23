import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { catalogOverview } from "@/modules/platform/catalogs/service";

export const metadata = { title: "Catálogos normativos" };

export default async function CatalogsPage() {
  const catalogs = await catalogOverview();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Catálogos normativos</h1>
      <p className="text-muted-foreground text-sm">
        La normativa es dato, no código. Cada catálogo es versionado: una versión publicada no se
        modifica; los cambios se hacen en un borrador y se publican con su vigencia y norma fuente.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {catalogs.map((c) => (
          <li key={c.key}>
            <Link href={`/catalogos/${c.key}`} className="block">
              <Card className="hover:bg-muted h-full space-y-2">
                <h2 className="font-semibold">{c.label}</h2>
                <p className="text-muted-foreground text-sm">{c.description}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {c.published ? (
                    <Badge variant="success">
                      v{c.published.version} · vigente desde {formatDate(c.published.effectiveFrom)}
                    </Badge>
                  ) : (
                    <Badge variant="warning">Sin publicar</Badge>
                  )}
                  {c.draft && <Badge>Borrador v{c.draft.version}</Badge>}
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
