import Link from "@/components/ui/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { bogotaDate } from "@/core/calendar/business-days";
import { can } from "@/core/rbac/can";
import { addMonths } from "@/lib/dates";
import { dashboard } from "@/modules/indicators/service";
import { AnalysisForm, TargetForm } from "./forms";
import { FormModal } from "@/components/ui/modal";

export const metadata = { title: "Indicadores" };
const STATUS = {
  cumple: ["success", "Cumple la meta"],
  no_cumple: ["destructive", "No cumple la meta"],
  sin_meta: ["default", "Sin meta"],
  sin_datos: ["default", "Sin datos"],
} as const;
const fmt = (v: number | null) =>
  v === null ? "—" : new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(v);

function Bars({ values, labels }: { values: (number | null)[]; labels: string[] }) {
  const max = Math.max(...values.map((v) => v ?? 0), 0.0001);
  const w = 28;
  return (
    <svg
      viewBox={`0 0 ${values.length * (w + 8)} 56`}
      className="h-14 w-full max-w-xs"
      role="img"
      aria-label={`Tendencia: ${values.map((v, i) => `${labels[i]} ${fmt(v)}`).join(", ")}`}
    >
      {values.map((v, i) => {
        const h = v === null ? 2 : Math.max(2, (v / max) * 50);
        return (
          <rect
            key={labels[i]}
            x={i * (w + 8)}
            y={54 - h}
            width={w}
            height={h}
            rx={3}
            className={i === values.length - 1 ? "fill-primary" : "fill-muted-foreground/40"}
          />
        );
      })}
    </svg>
  );
}

export default async function IndicatorsPage({ searchParams }: PageProps<"/tenant/indicadores">) {
  const ctx = await requirePermission("indicators", "view");
  const sp = await searchParams;
  const today = bogotaDate(new Date());
  const month =
    typeof sp.mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes)
      ? sp.mes
      : today.slice(0, 7);
  const rows = await dashboard(ctx.tenant.tenantId, `${month}-01`);
  const edit = can(ctx.permissions, "indicators", "edit");
  const prev = addMonths(`${month}-01`, -1).slice(0, 7);
  const next = addMonths(`${month}-01`, 1).slice(0, 7);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Indicadores del SG-SST</h1>
      <nav className="flex items-center gap-2" aria-label="Mes de referencia">
        <Link
          href={`/indicadores?mes=${prev}`}
          className="min-h-11 rounded-md border px-3 py-2 text-sm"
        >
          ← {prev}
        </Link>
        <span className="px-3 py-2 text-sm font-semibold">{month}</span>
        {next <= today.slice(0, 7) && (
          <Link
            href={`/indicadores?mes=${next}`}
            className="min-h-11 rounded-md border px-3 py-2 text-sm"
          >
            {next} →
          </Link>
        )}
      </nav>
      <p className="text-muted-foreground text-sm">
        Cada indicador se calcula con el periodo (mes, trimestre, semestre o año) que contiene el
        mes de referencia. Las fórmulas, factores y metas vienen del catálogo normativo; todas son
        provisionales hasta validarlas con el experto SST.
      </p>
      {rows.length === 0 && (
        <Card>
          <p className="text-muted-foreground text-sm">
            El catálogo de indicadores aún no está cargado. Contacta al administrador de la
            plataforma.
          </p>
        </Card>
      )}
      {rows.map((r) => {
        const [variant, label] = STATUS[r.status];
        return (
          <Card key={r.code}>
            <CardTitle>{r.name}</CardTitle>
            <p className="text-muted-foreground mt-1 text-xs">
              {r.periodicity} · ({r.numerator}) ÷ ({r.denominator}) ×{" "}
              {new Intl.NumberFormat("es-CO").format(r.factor)} · {r.sourceNorm}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <p className="text-3xl font-bold">{fmt(r.current.value)}</p>
              <div className="space-y-1 text-sm">
                <Badge variant={variant}>{label}</Badge>
                <p>
                  Meta: {fmt(r.target)}
                  {r.ownTarget ? " (de la empresa)" : ""}
                  {r.trend
                    ? ` · ${r.trend === "sube" ? "↑ sube" : r.trend === "baja" ? "↓ baja" : "→ igual"} frente al periodo anterior`
                    : ""}
                </p>
                {r.current.measure && (
                  <p className="text-muted-foreground">
                    {r.current.measure.numerator} ÷ {r.current.measure.denominator} ·{" "}
                    {r.current.from} a {r.current.to}
                  </p>
                )}
              </div>
            </div>
            {!r.auto && (
              <p className="text-muted-foreground mt-2 text-sm">
                Este indicador no tiene cálculo automático todavía.
              </p>
            )}
            <div className="mt-3">
              <Bars
                values={r.points.map((p) => p.value)}
                labels={r.points.map((p) => p.from.slice(0, 7))}
              />
              <details className="text-sm">
                <summary className="text-primary min-h-11 cursor-pointer py-2">
                  Ver valores por periodo
                </summary>
                <table className="w-full text-left">
                  <tbody>
                    {r.points.map((p) => (
                      <tr key={p.from} className="border-t">
                        <th scope="row" className="py-1 font-normal">
                          {p.from} a {p.to}
                        </th>
                        <td className="py-1 text-right">{fmt(p.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
            {edit ? (
              <div className="mt-3 space-y-4">
                <FormModal title="Registrar análisis" trigger="Registrar análisis">
                  <AnalysisForm
                    code={r.code}
                    periodicity={r.periodicity}
                    from={r.current.from}
                    saved={r.analysis}
                  />
                </FormModal>
                <FormModal title="Definir meta" trigger="Definir meta">
                  <TargetForm code={r.code} target={r.target} own={r.ownTarget} />
                </FormModal>
              </div>
            ) : (
              r.analysis && <p className="mt-3 text-sm whitespace-pre-wrap">{r.analysis}</p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
