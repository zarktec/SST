import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { CATALOGS, isCatalogKey } from "@/modules/platform/catalogs/definitions";
import { countItems, listVersions } from "@/modules/platform/catalogs/service";
import { createDraftAction } from "../actions";

const STATUS = {
  draft: ["Borrador", "warning"],
  published: ["Vigente", "success"],
  retired: ["Retirada", "default"],
} as const;

export default async function CatalogVersions({
  params,
}: PageProps<"/platform/catalogos/[catalog]">) {
  const { catalog } = await params;
  if (!isCatalogKey(catalog)) notFound();
  const versions = await listVersions(catalog);
  const counts = await Promise.all(versions.map((v) => countItems(v.id)));
  const hasDraft = versions.some((v) => v.status === "draft");
  return (
    <div className="space-y-4">
      <div>
        <Link href="/catalogos" className="text-brand-text text-sm underline">
          ← Catálogos
        </Link>
        <h1 className="text-2xl font-bold">{CATALOGS[catalog].label}</h1>
        <p className="text-muted-foreground text-sm">{CATALOGS[catalog].description}</p>
      </div>
      {!hasDraft && (
        <form action={createDraftAction.bind(null, catalog)}>
          <Button type="submit">Crear borrador (copia la versión vigente)</Button>
        </form>
      )}
      <Card>
        <CardTitle>Versiones</CardTitle>
        {versions.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Aún no hay versiones. Crea un borrador para empezar a cargar elementos.
          </p>
        ) : (
          <ul className="mt-2 divide-y">
            {versions.map((v, i) => (
              <li key={v.id}>
                <Link
                  href={`/catalogos/${catalog}/${v.id}`}
                  className="hover:bg-muted flex flex-wrap items-center justify-between gap-2 px-1 py-3 text-sm"
                >
                  <span className="font-medium">
                    Versión {v.version}{" "}
                    <span className="text-muted-foreground font-normal">
                      · {counts[i]} elementos
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      {v.effectiveFrom
                        ? `${formatDate(v.effectiveFrom)}${v.effectiveTo ? ` → ${formatDate(v.effectiveTo)}` : ""}`
                        : "sin vigencia"}
                    </span>
                    <Badge variant={STATUS[v.status][1]}>{STATUS[v.status][0]}</Badge>
                  </span>
                  {v.sourceNorm && (
                    <span className="text-muted-foreground w-full text-xs">{v.sourceNorm}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
