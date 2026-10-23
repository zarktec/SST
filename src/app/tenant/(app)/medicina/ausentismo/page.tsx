import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatCOP, formatDate } from "@/lib/format";
import { CAUSES } from "@/modules/medical/rules";
import { absenteeismStats, listAbsences } from "@/modules/medical/service";
import { listWorkers } from "@/modules/workers/service";
import { AbsenceForm, CloseAbsenceForm } from "../forms";

export const metadata = { title: "Ausentismo" };

export default async function AbsencePage({
  searchParams,
}: PageProps<"/tenant/medicina/ausentismo">) {
  const ctx = await requirePermission("medical", "view");
  const sp = await searchParams;
  const now = new Date();
  const month =
    typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes)
      ? sp.mes
      : now.toISOString().slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const from = `${month}-01`;
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const [rows, stats, people] = await Promise.all([
    listAbsences(ctx.tenant.tenantId),
    absenteeismStats(ctx.tenant.tenantId, from, to),
    listWorkers(ctx.tenant.tenantId, { status: "active" }),
  ]);
  const label = new Map(CAUSES.map((c) => [c.value as string, c.label]));
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  return (
    <div className="space-y-4">
      <Link href="/medicina" className="text-primary text-sm underline">
        ← Medicina del trabajo
      </Link>
      <h1 className="text-2xl font-bold">Ausentismo e incapacidades</h1>
      <nav className="flex gap-2" aria-label="Mes">
        <Link
          href={`/medicina/ausentismo?mes=${prev}`}
          className="min-h-11 rounded-md border px-3 py-2 text-sm"
        >
          ← {prev}
        </Link>
        <span className="px-3 py-2 text-sm font-semibold">{month}</span>
        <Link
          href={`/medicina/ausentismo?mes=${next}`}
          className="min-h-11 rounded-md border px-3 py-2 text-sm"
        >
          {next} →
        </Link>
      </nav>
      <Card>
        <p className="text-lg font-semibold">{stats.rate}% de ausentismo</p>
        <p className="text-muted-foreground text-sm">
          {stats.lostDays} días perdidos · {stats.workers} trabajadores · {stats.periodDays} días
        </p>
        <ul className="mt-2 text-sm">
          {stats.causes.map((c) => (
            <li key={c.cause}>
              {label.get(c.cause)}: {c.days} días ({c.cases} casos)
              {c.cost > 0n ? ` · ${formatCOP(c.cost)}` : ""}
            </li>
          ))}
        </ul>
      </Card>
      {can(ctx.permissions, "medical", "create") && (
        <Card>
          <CardTitle>Registrar ausencia</CardTitle>
          <div className="mt-3">
            <AbsenceForm people={people.map((p) => ({ id: p.id, name: p.fullName }))} />
          </div>
        </Card>
      )}
      <Card>
        <CardTitle>Registro</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {rows.map((a) => (
            <li key={a.id} className="space-y-2 py-2">
              <p>
                <span className="font-semibold">{a.workerName}</span> · {label.get(a.cause)} ·{" "}
                {formatDate(a.startDate)} → {a.endDate ? formatDate(a.endDate) : "en curso"}{" "}
                {a.medical ? <Badge>Médica</Badge> : <Badge variant="warning">No médica</Badge>}
              </p>
              {!a.endDate && can(ctx.permissions, "medical", "edit") && (
                <CloseAbsenceForm id={a.id} />
              )}
            </li>
          ))}
          {rows.length === 0 && <li className="text-muted-foreground py-2">Sin registros.</li>}
        </ul>
      </Card>
    </div>
  );
}
