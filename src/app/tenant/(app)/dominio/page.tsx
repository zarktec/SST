import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { rootDomain, originFor } from "@/core/tenancy/hosts";
import { listTenantDomains } from "@/modules/platform/tenants/service";
import { requireBillingAdmin } from "../facturacion/guard";
import { ConnectDomainForm, VerifyButton } from "./forms";
import { FormModal } from "@/components/ui/modal";

export const metadata = { title: "Dominio propio" };

const STATUS = {
  pending: ["Pendiente de DNS", "warning"],
  verified: ["Verificado", "success"],
  error: ["Con error", "destructive"],
} as const;

export default async function DomainPage() {
  const ctx = await requireBillingAdmin();
  const domains = (await listTenantDomains(ctx.tenant.tenantId)).filter((d) => d.kind === "custom");
  const hasActive = domains.some((d) => d.status !== "error");
  const defaultUrl = `${originFor(rootDomain())}/${ctx.tenant.slug}`;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Dominio propio</h1>
      <Card>
        <CardTitle>Dirección de tu empresa</CardTitle>
        <CardDescription className="mt-1">
          Tu empresa siempre está disponible en{" "}
          <strong>{defaultUrl.replace(/^https?:\/\//, "")}</strong>. Si prefieres tu propio dominio
          (por ejemplo <em>sst.mi-empresa.com</em>), conéctalo aquí: tus usuarios entrarán
          directamente en él, sin el identificador en la ruta.
        </CardDescription>
      </Card>
      {domains.map((d) => (
        <Card key={d.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{d.host}</CardTitle>
            <Badge variant={STATUS[d.status][1]}>{STATUS[d.status][0]}</Badge>
          </div>
          {d.lastError && <p className="text-destructive mt-1 text-sm">{d.lastError}</p>}
          {d.status !== "verified" && (
            <div className="mt-3 space-y-2 text-sm">
              {d.dnsRecords?.length ? (
                <>
                  <p>Crea estos registros en el DNS de tu dominio:</p>
                  <table className="w-full text-left">
                    <thead className="text-muted-foreground text-xs">
                      <tr>
                        <th className="py-1">Tipo</th>
                        <th>Nombre</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.dnsRecords.map((r) => (
                        <tr key={`${r.type}-${r.name}-${r.value}`} className="border-t">
                          <td className="py-1 font-mono">{r.type}</td>
                          <td className="font-mono">{r.name}</td>
                          <td className="font-mono break-all">{r.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : null}
              <VerifyButton />
            </div>
          )}
          {d.status === "verified" && (
            <p className="text-muted-foreground mt-2 text-sm">
              Ya puedes entrar en <strong>{d.host}</strong>. La primera vez te pediremos iniciar
              sesión de nuevo en ese dominio.
            </p>
          )}
        </Card>
      ))}
      {!hasActive && (
        <Card>
          <CardTitle>Conectar un dominio</CardTitle>
          <div className="mt-3">
            <FormModal
              title="Conectar dominio propio"
              trigger="Conectar dominio propio"
              triggerVariant="default"
            >
              <ConnectDomainForm />
            </FormModal>
          </div>
        </Card>
      )}
    </div>
  );
}
