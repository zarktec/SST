import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { furatData } from "@/modules/incidents/service";

export const metadata = { title: "Datos precargados del FURAT" };

const Section = ({ title, data }: { title: string; data: Record<string, unknown> }) => (
  <Card>
    <CardTitle>{title}</CardTitle>
    <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
      {Object.entries(data).map(([k, v]) => (
        <div key={k}>
          <dt className="text-muted-foreground text-xs">{k}</dt>
          <dd>{v === null || v === undefined || v === "" ? "—" : String(v)}</dd>
        </div>
      ))}
    </dl>
  </Card>
);

export default async function FuratPage({ params }: PageProps<"/tenant/accidentes/[id]/furat">) {
  const ctx = await requirePermission("incidents", "view");
  const { id } = await params;
  const d = await furatData(ctx.tenant.tenantId, ctx.user.id, id);
  if (!d) notFound();
  return (
    <div className="space-y-4">
      <Link href={`/accidentes/${id}`} className="text-primary text-sm underline print:hidden">
        ← Evento
      </Link>
      <h1 className="text-2xl font-bold">Datos para el reporte a la ARL (FURAT)</h1>
      <Alert>
        Copia estos datos en el formato de tu ARL. Esta consulta incluye el documento del trabajador
        y queda registrada.
      </Alert>
      <Section title="Empleador" data={d.empleador} />
      <Section title="Trabajador" data={d.trabajador} />
      <Section title="Evento" data={d.evento} />
    </div>
  );
}
