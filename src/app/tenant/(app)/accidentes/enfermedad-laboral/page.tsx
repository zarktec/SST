import Link from "@/components/ui/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { listDiseases } from "@/modules/incidents/service";
import { listWorkers } from "@/modules/workers/service";
import { DiseaseForm, QualifyForm } from "../forms";

export const metadata = { title: "Enfermedad laboral" };

export default async function DiseasePage() {
  const ctx = await requirePermission("incidents", "view");
  const t = ctx.tenant.tenantId;
  const edit = can(ctx.permissions, "incidents", "edit");
  const [rows, people] = await Promise.all([
    listDiseases(t),
    edit ? listWorkers(t, { status: "active" }) : Promise.resolve([]),
  ]);
  return (
    <div className="space-y-4">
      <Link href="/accidentes" className="text-primary text-sm underline">
        ← Accidentes e incidentes
      </Link>
      <h1 className="text-2xl font-bold">Enfermedad laboral</h1>
      {edit && (
        <Card>
          <CardTitle>Registrar un caso</CardTitle>
          <div className="mt-3">
            <DiseaseForm people={people.map((p) => ({ id: p.id, name: p.fullName }))} />
          </div>
        </Card>
      )}
      <Card>
        <CardTitle>Casos</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {rows.map((d) => (
            <li key={d.id} className="space-y-2 py-3">
              <p>
                <span className="font-semibold">{d.workerName}</span> · {d.diagnosis} ·{" "}
                {formatDate(d.detectedOn)}{" "}
                {d.qualification ? (
                  <Badge variant={d.qualification === "occupational" ? "destructive" : "default"}>
                    {d.qualification === "occupational" ? "Origen laboral" : "Origen común"}
                  </Badge>
                ) : (
                  <Badge variant="warning">Sin calificar</Badge>
                )}
              </p>
              {edit && !d.qualification && <QualifyForm id={d.id} />}
            </li>
          ))}
          {rows.length === 0 && <li className="text-muted-foreground py-2">Sin casos.</li>}
        </ul>
      </Card>
    </div>
  );
}
