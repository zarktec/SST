import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { CATALOGS, isCatalogKey } from "@/modules/platform/catalogs/definitions";
import { countItems, getVersion, listItems } from "@/modules/platform/catalogs/service";
import { z } from "zod";
import { DraftTools, ItemRow } from "./tools";

const PAGE = 100;

const cell = (v: unknown) =>
  v === null || v === undefined ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

export default async function VersionPage({
  params,
  searchParams,
}: PageProps<"/platform/catalogos/[catalog]/[versionId]">) {
  const { catalog, versionId } = await params;
  const sp = await searchParams;
  if (!isCatalogKey(catalog)) notFound();
  const v = await getVersion(versionId);
  if (!v || v.catalog !== catalog) notFound();
  const page = Math.max(1, Number(typeof sp.page === "string" ? sp.page : 1) || 1);
  const [items, total] = await Promise.all([
    listItems(v.id, { limit: PAGE, offset: (page - 1) * PAGE }),
    countItems(v.id),
  ]);
  const def = CATALOGS[catalog];
  const editable = v.status === "draft";
  const fields = Object.keys(
    (z.toJSONSchema(def.schema) as { properties?: Record<string, unknown> }).properties ?? {},
  );
  const pages = Math.max(1, Math.ceil(total / PAGE));
  return (
    <div className="space-y-4">
      <div>
        <Link href={`/catalogos/${catalog}`} className="text-brand-text text-sm underline">
          ← {def.label}
        </Link>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
          Versión {v.version}{" "}
          <Badge variant={editable ? "warning" : v.status === "published" ? "success" : "default"}>
            {editable ? "Borrador" : v.status === "published" ? "Vigente" : "Retirada"}
          </Badge>
        </h1>
        {v.sourceNorm && (
          <p className="text-muted-foreground text-sm">
            {v.sourceNorm} · desde {formatDate(v.effectiveFrom)}
          </p>
        )}
      </div>
      {editable && <DraftTools versionId={v.id} fields={fields} />}
      <Card>
        <CardTitle>Elementos ({total})</CardTitle>
        {items.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">
            Sin elementos. Agrega uno o importa un archivo CSV/JSON.
          </p>
        ) : (
          <ul className="mt-2 divide-y">
            {items.map((i) => (
              <ItemRow
                key={i.id}
                versionId={v.id}
                code={i.code}
                editable={editable}
                summary={def.columns
                  .map((c) => `${c}: ${cell((i.data as Record<string, unknown>)[c])}`)
                  .join(" · ")}
                json={JSON.stringify(i.data, null, 2)}
                todo={(i.data as { todoNorma?: boolean }).todoNorma === true}
              />
            ))}
          </ul>
        )}
        {pages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            {page > 1 ? (
              <Link className="underline" href={`?page=${page - 1}`}>
                Anterior
              </Link>
            ) : (
              <span />
            )}
            <span className="text-muted-foreground">
              Página {page} de {pages}
            </span>
            {page < pages ? (
              <Link className="underline" href={`?page=${page + 1}`}>
                Siguiente
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
