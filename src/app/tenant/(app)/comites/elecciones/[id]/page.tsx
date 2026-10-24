import Link from "@/components/ui/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { KIND_LABEL } from "@/modules/committees/rules";
import { getElection } from "@/modules/committees/service";
import { listWorkers } from "@/modules/workers/service";
import { ApplyForm, CandidateButton, CloseVotingButton, OpenVoting, TieForm } from "../../forms";

export const metadata = { title: "Elección" };

export default async function ElectionPage({
  params,
}: PageProps<"/tenant/comites/elecciones/[id]">) {
  const ctx = await requirePermission("committees", "view");
  const data = await getElection(ctx.tenant.tenantId, (await params).id);
  if (!data) notFound();
  const { election: e, candidates, eligible, voted } = data;
  const canEdit = can(ctx.permissions, "committees", "edit");
  const people = (await listWorkers(ctx.tenant.tenantId, { status: "active" })).filter(
    (p) => p.kind !== "contractor",
  );
  const candidateWorkers = new Set(candidates.map((c) => c.workerId));
  const r = e.result;
  return (
    <div className="space-y-4">
      <Link href="/comites" className="text-primary text-sm underline">
        ← Comités
      </Link>
      <h1 className="text-2xl font-bold">
        Elección de representantes · {KIND_LABEL[e.kind as "copasst" | "vigia"]}
      </h1>
      <p className="text-muted-foreground text-sm">
        {e.principalSeats} principales y {e.alternateSeats} suplentes · votación{" "}
        {e.votingOpensOn ? formatDate(e.votingOpensOn) : "—"} →{" "}
        {e.votingClosesOn ? formatDate(e.votingClosesOn) : "—"} ·{" "}
        <Badge>
          {e.status === "registration"
            ? "Inscripción"
            : e.status === "voting"
              ? "Votación"
              : "Cerrada"}
        </Badge>
      </p>
      <Card>
        <CardTitle>Candidatos ({candidates.length})</CardTitle>
        <ul className="mt-2 text-sm">
          {candidates.map((c) => (
            <li key={c.id} className="py-1">
              {c.name}
            </li>
          ))}
        </ul>
        {e.status === "registration" && canEdit && (
          <div className="mt-3 space-y-3">
            <details>
              <summary className="text-primary min-h-11 cursor-pointer py-2 text-sm">
                Inscribir candidato
              </summary>
              <div className="flex flex-col gap-2">
                {people
                  .filter((p) => !candidateWorkers.has(p.id))
                  .map((p) => (
                    <CandidateButton
                      key={p.id}
                      electionId={e.id}
                      workerId={p.id}
                      name={p.fullName}
                    />
                  ))}
              </div>
            </details>
            <OpenVoting electionId={e.id} />
          </div>
        )}
      </Card>
      {e.status === "voting" && (
        <Card>
          <CardTitle>Votación en curso</CardTitle>
          <p className="mt-1 text-sm">
            {voted} de {eligible} trabajadores han votado.
          </p>
          {canEdit && (
            <div className="mt-3">
              <CloseVotingButton id={e.id} />
            </div>
          )}
        </Card>
      )}
      {e.status === "closed" && r && (
        <Card>
          <CardTitle>Escrutinio</CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            {r.totalVotes} votos emitidos · habilitados {r.eligible}.
          </p>
          <ul className="mt-2 divide-y text-sm">
            {r.rows.map((x) => (
              <li
                key={x.candidateId}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <span>
                  {x.name} · {x.votes} votos
                </span>
                {x.seat ? (
                  <Badge variant="success">
                    {x.seat === "principal" ? "Principal" : "Suplente"}
                  </Badge>
                ) : r.tie ? (
                  <Badge variant="warning">Empate</Badge>
                ) : (
                  <Badge>No electo</Badge>
                )}
              </li>
            ))}
          </ul>
          {e.resolutionNote && (
            <p className="text-muted-foreground mt-2 text-sm">
              Resolución del empate: {e.resolutionNote}
            </p>
          )}
          {r.tie && canEdit && (
            <div className="mt-3 border-t pt-3">
              <Alert variant="warning" className="mb-3">
                Hay un empate en el corte de los puestos. Resuélvelo para continuar.
              </Alert>
              <TieForm
                electionId={e.id}
                rows={r.rows.map((x) => ({
                  candidateId: x.candidateId,
                  name: x.name,
                  votes: x.votes,
                }))}
              />
            </div>
          )}
          {!r.tie && !e.appliedCommitteeId && can(ctx.permissions, "committees", "create") && (
            <div className="mt-3 border-t pt-3">
              <CardTitle>Conformar el comité</CardTitle>
              <div className="mt-3">
                <ApplyForm
                  electionId={e.id}
                  people={people.map((p) => ({ id: p.id, name: p.fullName }))}
                />
              </div>
            </div>
          )}
          {e.appliedCommitteeId && (
            <Alert variant="success" className="mt-3">
              El comité ya fue conformado con este resultado.
            </Alert>
          )}
        </Card>
      )}
    </div>
  );
}
