import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { KIND_LABEL } from "@/modules/committees/rules";
import {
  activeCommittees,
  committeeStatus,
  listElections,
  suggestedKind,
} from "@/modules/committees/service";
import { ElectionForm } from "./forms";

export const metadata = { title: "Comités" };
const ELECTION: Record<string, string> = {
  registration: "Inscripción de candidatos",
  voting: "Votación abierta",
  closed: "Cerrada",
  draft: "Borrador",
};

export default async function CommitteesPage() {
  const ctx = await requirePermission("committees", "view");
  const t = ctx.tenant.tenantId;
  const [list, elections, kind] = await Promise.all([
    activeCommittees(t, ["copasst", "vigia"]),
    listElections(t),
    suggestedKind(t),
  ]);
  const statuses = await Promise.all(list.map((c) => committeeStatus(t, c.id)));
  const canCreate = can(ctx.permissions, "committees", "create");
  const running = elections.find(
    (e) => e.status !== "closed" || (e.result && !e.appliedCommitteeId),
  );
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Comités</h1>
      {!kind && (
        <Alert>
          Completa el número de trabajadores en el onboarding para saber si te corresponde COPASST o
          Vigía SST.
        </Alert>
      )}
      {list.length === 0 && kind && (
        <Alert variant="warning">
          Aún no tienes {kind === "copasst" ? "COPASST" : "Vigía SST"} conformado (te corresponde
          por el tamaño de la empresa).
        </Alert>
      )}
      {list.map((c, i) => {
        const st = statuses[i]!;
        return (
          <Card key={c.id}>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/comites/${c.id}`} className="text-lg font-semibold underline">
                {KIND_LABEL[c.kind as "copasst" | "vigia"]}
              </Link>
              <Badge>
                {formatDate(c.periodStart)} → {formatDate(c.periodEnd)}
              </Badge>
              {st.renewal === "por_vencer" && <Badge variant="warning">Renovación próxima</Badge>}
              {st.renewal === "vencido" && <Badge variant="destructive">Periodo vencido</Badge>}
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {c.members.length} integrantes · {st.openCommitments} compromisos abiertos
              {st.overdueCommitments ? ` (${st.overdueCommitments} vencidos)` : ""}
            </p>
            {st.gaps.missing.length > 0 && (
              <Alert variant="warning" className="mt-2">
                Sin reunión registrada en: {st.gaps.missing.join(", ")}.
              </Alert>
            )}
            {st.gaps.currentMonthPending && (
              <p className="text-muted-foreground mt-1 text-sm">
                La reunión de este mes aún no se ha registrado.
              </p>
            )}
          </Card>
        );
      })}
      {canCreate && kind && (
        <Card>
          <CardTitle>Conformar el comité</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            Por elección electrónica de los trabajadores, o directamente si ya tienen el acta de
            elección.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/comites/conformar" className="text-primary min-h-11 py-2 underline">
              Registrar conformación existente
            </Link>
          </div>
          {running ? (
            <p className="mt-3 text-sm">
              Hay una elección en curso:{" "}
              <Link href={`/comites/elecciones/${running.id}`} className="text-primary underline">
                {ELECTION[running.status] ?? running.status}
              </Link>
            </p>
          ) : (
            <div className="mt-4 border-t pt-4">
              <h3 className="mb-2 text-sm font-semibold">Convocar elección electrónica</h3>
              <ElectionForm kind={kind} />
            </div>
          )}
        </Card>
      )}
      {elections.length > 0 && (
        <Card>
          <CardTitle>Elecciones</CardTitle>
          <ul className="mt-2 divide-y text-sm">
            {elections.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/comites/elecciones/${e.id}`}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-2 py-3"
                >
                  <span>
                    {KIND_LABEL[e.kind as "copasst" | "vigia"]} · {formatDate(e.createdAt)}
                  </span>
                  <Badge>{ELECTION[e.status]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
