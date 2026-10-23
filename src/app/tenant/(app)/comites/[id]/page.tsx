import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { requirePermission } from "@/core/auth/session";
import { can } from "@/core/rbac/can";
import { formatDate } from "@/lib/format";
import { KIND_LABEL } from "@/modules/committees/rules";
import { activeCommittees, committeeStatus } from "@/modules/committees/service";
import { CloseCommitmentForm, MinutesForm } from "../forms";

export const metadata = { title: "Comité" };

export default async function CommitteePage({ params }: PageProps<"/tenant/comites/[id]">) {
  const ctx = await requirePermission("committees", "view");
  const { id } = await params;
  const st = await committeeStatus(ctx.tenant.tenantId, id);
  if (!st || st.committee.kind === "ccl") notFound();
  const withMembers = (await activeCommittees(ctx.tenant.tenantId)).find((c) => c.id === id);
  const members = withMembers?.members ?? [];
  const canEdit = can(ctx.permissions, "committees", "edit") && st.committee.status === "active";
  const name = new Map(members.map((m) => [m.workerId, m.name]));
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="space-y-4">
      <Link href="/comites" className="text-primary text-sm underline">
        ← Comités
      </Link>
      <h1 className="text-2xl font-bold">{KIND_LABEL[st.committee.kind as "copasst" | "vigia"]}</h1>
      <p className="text-muted-foreground text-sm">
        Periodo {formatDate(st.committee.periodStart)} → {formatDate(st.committee.periodEnd)}
        {st.committee.status === "closed" ? " · cerrado" : ""}
      </p>
      {st.renewal !== "vigente" && st.committee.status === "active" && (
        <Alert variant={st.renewal === "vencido" ? "destructive" : "warning"}>
          {st.renewal === "vencido"
            ? "El periodo del comité venció: hay que conformarlo de nuevo."
            : "El periodo termina pronto: inicia la renovación del comité."}
        </Alert>
      )}
      <Card>
        <CardTitle>Integrantes</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="font-semibold">{m.name}</span>
              <span className="flex gap-2">
                <Badge>{m.representation === "employer" ? "Empleador" : "Trabajadores"}</Badge>
                <Badge>{m.seat === "principal" ? "Principal" : "Suplente"}</Badge>
                {m.role !== "miembro" && <Badge variant="success">{m.role}</Badge>}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      {st.gaps.missing.length > 0 && (
        <Alert variant="warning">Sin reunión registrada en: {st.gaps.missing.join(", ")}.</Alert>
      )}
      {canEdit && (
        <Card>
          <CardTitle>Registrar acta de reunión</CardTitle>
          <div className="mt-3">
            <MinutesForm
              committeeId={id}
              members={members.map((m) => ({ id: m.workerId, name: m.name }))}
            />
          </div>
        </Card>
      )}
      <Card>
        <CardTitle>Compromisos</CardTitle>
        {st.commitments.length === 0 ? (
          <p className="text-muted-foreground mt-2 text-sm">Sin compromisos.</p>
        ) : (
          <ul className="mt-2 divide-y text-sm">
            {st.commitments.map((c) => (
              <li key={c.id} className="space-y-2 py-2">
                <p>
                  <span className="font-semibold">{c.description}</span>
                  {c.responsibleName ? ` · ${c.responsibleName}` : ""}
                  {c.dueDate ? ` · ${formatDate(c.dueDate)}` : ""}{" "}
                  {c.status === "done" ? (
                    <Badge variant="success">Cumplido</Badge>
                  ) : c.dueDate && c.dueDate < today ? (
                    <Badge variant="destructive">Vencido</Badge>
                  ) : (
                    <Badge variant="warning">Abierto</Badge>
                  )}
                </p>
                {c.status === "open" && canEdit && <CloseCommitmentForm id={c.id} />}
                {c.closureNote && <p className="text-muted-foreground">{c.closureNote}</p>}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <CardTitle>Actas</CardTitle>
        <ul className="mt-2 divide-y text-sm">
          {st.minutes.map((m) => (
            <li key={m.id} className="py-2">
              <p className="font-semibold">
                {m.kind === "formation" ? "Acta de conformación" : "Reunión"} · {formatDate(m.date)}
              </p>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.attendeeIds.length > 0 && (
                <p className="text-muted-foreground">
                  Asistentes: {m.attendeeIds.map((a) => name.get(a) ?? "—").join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
