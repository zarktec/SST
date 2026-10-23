import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { schema, systemDb } from "@/core/db";
import { rootDomain } from "@/core/tenancy/hosts";
import { formatDateTime } from "@/lib/format";
import { getIntegrationView } from "@/integrations/registry/service";
import { INTEGRATION_KEYS, type IntegrationKey } from "@/integrations/registry/types";
import { IntegrationEditor } from "./editor";

export default async function IntegrationDetail({
  params,
}: PageProps<"/platform/integrations/[key]">) {
  const { key } = await params;
  if (!(INTEGRATION_KEYS as readonly string[]).includes(key)) notFound();
  const view = await getIntegrationView(key as IntegrationKey, rootDomain());
  const [row] = await systemDb()
    .select({ id: schema.integration.id })
    .from(schema.integration)
    .where(eq(schema.integration.key, key));
  const history = await systemDb()
    .select()
    .from(schema.integrationChangeLog)
    .where(eq(schema.integrationChangeLog.integrationId, row.id))
    .orderBy(desc(schema.integrationChangeLog.at))
    .limit(20);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{view.label}</h1>
      {view.activeEnv === "sandbox" && (
        <Alert variant="warning">
          Esta integración opera en <strong>SANDBOX</strong> (pruebas). Cambia a producción cuando
          esté lista.
        </Alert>
      )}
      <IntegrationEditor view={JSON.parse(JSON.stringify(view))} />
      <Card>
        <CardTitle>Historial de cambios</CardTitle>
        <p className="text-muted-foreground mt-1 text-xs">
          Quién cambió qué y cuándo. Nunca se registra el valor.
        </p>
        {history.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">Sin cambios todavía.</p>
        ) : (
          <ul className="mt-3 divide-y text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  {h.action} · <code>{h.field}</code>
                  {h.env ? ` (${h.env})` : ""}
                </span>
                <span className="text-muted-foreground">{formatDateTime(h.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
