import Link from "@/components/ui/link";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { suggestedKind } from "@/modules/committees/service";
import { listWorkers } from "@/modules/workers/service";
import { ConformForm } from "../forms";

export const metadata = { title: "Conformar comité" };

export default async function ConformPage() {
  const ctx = await requirePermission("committees", "create");
  const [kind, people] = await Promise.all([
    suggestedKind(ctx.tenant.tenantId),
    listWorkers(ctx.tenant.tenantId, { status: "active" }),
  ]);
  return (
    <div className="space-y-4">
      <Link href="/comites" className="text-primary text-sm underline">
        ← Comités
      </Link>
      <h1 className="text-2xl font-bold">Conformar {kind === "vigia" ? "Vigía SST" : "COPASST"}</h1>
      <Card>
        <CardTitle>Integrantes</CardTitle>
        <div className="mt-3">
          {kind ? (
            <ConformForm
              kind={kind}
              people={people
                .filter((p) => p.kind !== "contractor")
                .map((p) => ({ id: p.id, name: p.fullName }))}
            />
          ) : (
            <p className="text-sm">Define el número de trabajadores en el onboarding.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
