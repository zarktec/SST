import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { LEVELS, type Competency, type Tabulation } from "@/modules/performance/rules";

const fmt = (n: number | null) => (n === null ? "—" : n.toFixed(2).replace(".", ","));

/** Barra de 1 a 5 con el valor al lado (el color no es lo único que transmite el dato). */
function Bar({ value }: { value: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-2 w-24 rounded-full" aria-hidden>
        <div
          className="bg-primary h-2 rounded-full"
          style={{ width: `${value === null ? 0 : (value / 5) * 100}%` }}
        />
      </div>
      <span className="tabular-nums">{fmt(value)}</span>
    </div>
  );
}

/** Tabulador 360 de una persona: promedio por competencia y nivel, total, y comentarios (sin autor en ciclos anónimos). */
export function ResultsView({
  name,
  position,
  competencies,
  tab,
  comments,
  anonymous,
}: {
  name: string;
  position: string | null;
  competencies: Competency[];
  tab: Tabulation;
  comments: { level: string; text: string }[];
  anonymous: boolean;
}) {
  const answered = LEVELS.filter((l) => tab.counts[l.value] > 0);
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <CardTitle>
          {name}
          {position && (
            <span className="text-muted-foreground text-sm font-normal"> · {position}</span>
          )}
        </CardTitle>
        <p className="text-sm">
          Promedio general: <strong className="text-lg tabular-nums">{fmt(tab.overall)}</strong> / 5
        </p>
      </div>
      {answered.length === 0 ? (
        <Alert variant="warning">Aún no hay evaluaciones respondidas para esta persona.</Alert>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <caption className="sr-only">
              Calificaciones por competencia y nivel de evaluador
            </caption>
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Competencia
                </th>
                {LEVELS.map((l) => (
                  <th key={l.value} scope="col" className="px-2 py-2 font-medium">
                    {l.label} <span className="font-normal">({tab.counts[l.value]})</span>
                  </th>
                ))}
                <th scope="col" className="px-2 py-2 font-medium">
                  Promedio
                </th>
              </tr>
            </thead>
            <tbody>
              {tab.rows.map((r) => (
                <tr key={r.key} className="border-b last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    {competencies.find((c) => c.key === r.key)?.name ?? r.key}
                  </th>
                  {LEVELS.map((l) => (
                    <td key={l.value} className="px-2 py-2 tabular-nums">
                      {fmt(r.byLevel[l.value])}
                    </td>
                  ))}
                  <td className="px-2 py-2">
                    <Bar value={r.overall} />
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <th scope="row" className="py-2 pr-3 text-left">
                  Total
                </th>
                {LEVELS.map((l) => (
                  <td key={l.value} className="px-2 py-2 tabular-nums">
                    {fmt(tab.levelTotals[l.value])}
                  </td>
                ))}
                <td className="px-2 py-2">
                  <Bar value={tab.overall} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {comments.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium">Comentarios{anonymous && " (anónimos)"}</p>
          <ul className="space-y-1 text-sm">
            {comments.map((c, i) => (
              <li key={i} className="bg-muted rounded-md p-2">
                <span className="text-muted-foreground text-xs">
                  {LEVELS.find((l) => l.value === c.level)?.label}:{" "}
                </span>
                {c.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
