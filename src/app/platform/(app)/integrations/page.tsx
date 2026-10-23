import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { rootDomain } from "@/core/tenancy/hosts";
import { formatDateTime } from "@/lib/format";
import { getIntegrationView, integrationAlerts } from "@/integrations/registry/service";
import { INTEGRATION_KEYS } from "@/integrations/registry/types";

export const metadata = { title: "Integraciones" };

const ALERT_TEXT = {
  secret_expiring: "Secreto próximo a vencer",
  secret_expired: "Secreto vencido",
  repeated_failures: "Fallos repetidos",
} as const;

export default async function IntegrationsPage() {
  const [views, alerts] = await Promise.all([
    Promise.all(INTEGRATION_KEYS.map((k) => getIntegrationView(k, rootDomain()))),
    integrationAlerts(),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Integraciones</h1>
      <p className="text-muted-foreground text-sm">
        Las credenciales se guardan cifradas y nunca se vuelven a mostrar completas. Cada
        integración tiene ambiente de pruebas (sandbox) y de producción.
      </p>
      {alerts.map((a) => (
        <Alert key={`${a.integration}-${a.detail}`} variant="warning">
          <strong>{ALERT_TEXT[a.kind]}</strong> · {a.integration}: {a.detail}
        </Alert>
      ))}
      <ul className="grid gap-3 sm:grid-cols-2">
        {views.map((v) => (
          <li key={v.key}>
            <Link href={`/integrations/${v.key}`} className="block">
              <Card className="hover:bg-muted h-full space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{v.label}</h2>
                  <Badge variant={v.enabled ? "success" : "default"}>
                    {v.enabled ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                <p className="text-muted-foreground text-sm">{v.description}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant={v.activeEnv === "production" ? "default" : "warning"}>
                    Ambiente: {v.activeEnv === "production" ? "producción" : "sandbox"}
                  </Badge>
                  {v.lastTestAt && (
                    <Badge variant={v.lastTestOk ? "success" : "destructive"}>
                      Prueba {v.lastTestOk ? "OK" : "fallida"} · {formatDateTime(v.lastTestAt)}
                    </Badge>
                  )}
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
