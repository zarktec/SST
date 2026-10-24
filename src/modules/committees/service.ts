import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { schema, withTenant, type Tx } from "@/core/db";
import { assertWritable } from "@/core/plans/limits";
import { sendMail } from "@/core/mail";
import { tenantUrl } from "@/core/tenancy/urls";
import { todayYmd } from "@/lib/dates";
import { getParameter } from "@/modules/platform/catalogs/service";
import {
  committeeKindFor,
  electionSchema,
  hashToken,
  meetingGaps,
  minutesSchema,
  newVoteToken,
  renewalState,
  scrutinize,
  validateComposition,
  type ElectionInput,
  type Kind,
  type MemberDraft,
  type MinutesInput,
} from "./rules";

const {
  committee,
  committeeMember,
  committeeMinutes,
  committeeCommitment,
  election,
  electionCandidate,
  electionVoter,
  electionBallot,
  worker,
  tenant,
} = schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });

export class CommitteeError extends Error {}

/** Trabajadores que votan: personal vinculado y aprendices activos (los contratistas no eligen al comité). */
async function eligibleVoters(tx: Tx, tenantId: string) {
  const t = todayYmd();
  const rows = await tx
    .select()
    .from(worker)
    .where(
      and(eq(worker.tenantId, tenantId), isNull(worker.deletedAt), ne(worker.kind, "contractor")),
    );
  return rows.filter((w) => !w.endDate || w.endDate >= t);
}

export async function suggestedKind(tenantId: string): Promise<"copasst" | "vigia" | null> {
  const threshold = await getParameter("comite.umbral_copasst", 10);
  return withTenant(ctxOf(tenantId), async (tx) => {
    const [t] = await tx
      .select({ n: tenant.workersCount })
      .from(tenant)
      .where(eq(tenant.id, tenantId));
    return t?.n ? committeeKindFor(t.n, threshold) : null;
  });
}

/**
 * Conforma (o renueva) un comité: cierra el vigente de su tipo y sede, valida la composición, crea los miembros y el acta de
 * conformación. Para COPASST/Vigía exige que el tipo corresponda al tamaño de la empresa.
 */
export async function conformCommittee(
  tenantId: string,
  userId: string,
  input: {
    kind: Kind;
    workCenterId?: string | null;
    periodStart: string;
    members: MemberDraft[];
    regulations?: string;
  },
  opts: { extraValidation?: (tx: Tx, members: MemberDraft[]) => Promise<string[]> } = {},
) {
  await assertWritable(tenantId);
  const years = await getParameter("comite.periodo_anios", 2);
  const threshold = await getParameter("comite.umbral_copasst", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.periodStart))
    throw new CommitteeError("Fecha de inicio inválida");
  const errors = validateComposition(input.kind, input.members);
  if (errors.length) throw new CommitteeError(errors.join(". "));
  const periodEnd = `${Number(input.periodStart.slice(0, 4)) + years}${input.periodStart.slice(4)}`;
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    if (input.kind !== "ccl") {
      const [t] = await tx
        .select({ n: tenant.workersCount })
        .from(tenant)
        .where(eq(tenant.id, tenantId));
      if (t?.n && committeeKindFor(t.n, threshold) !== input.kind)
        throw new CommitteeError(
          `Con ${t.n} trabajadores corresponde ${committeeKindFor(t.n, threshold) === "copasst" ? "COPASST" : "Vigía SST"}`,
        );
    }
    const ids = input.members.map((m) => m.workerId);
    const found = await tx
      .select({ id: worker.id })
      .from(worker)
      .where(and(eq(worker.tenantId, tenantId), inArray(worker.id, ids), isNull(worker.deletedAt)));
    if (found.length !== new Set(ids).size)
      throw new CommitteeError("Alguna persona no existe en la empresa");
    if (opts.extraValidation) {
      const extra = await opts.extraValidation(tx, input.members);
      if (extra.length) throw new CommitteeError(extra.join(". "));
    }
    const same = and(
      eq(committee.tenantId, tenantId),
      eq(committee.kind, input.kind),
      eq(committee.status, "active"),
      input.workCenterId
        ? eq(committee.workCenterId, input.workCenterId)
        : isNull(committee.workCenterId),
    );
    await tx.update(committee).set({ status: "closed", updatedAt: new Date() }).where(same);
    const [c] = await tx
      .insert(committee)
      .values({
        tenantId,
        kind: input.kind,
        workCenterId: input.workCenterId ?? null,
        periodStart: input.periodStart,
        periodEnd,
        regulations: input.regulations ?? null,
      })
      .returning();
    await tx.insert(committeeMember).values(
      input.members.map((m) => ({
        tenantId,
        committeeId: c.id,
        workerId: m.workerId,
        representation: m.representation,
        seat: m.seat,
        role: m.role ?? "miembro",
      })),
    );
    await tx.insert(committeeMinutes).values({
      tenantId,
      committeeId: c.id,
      kind: "formation",
      date: input.periodStart,
      content: `Acta de conformación del ${input.kind === "ccl" ? "Comité de Convivencia Laboral" : input.kind === "copasst" ? "COPASST" : "Vigía SST"} para el periodo ${input.periodStart} a ${periodEnd}. Integrantes: ${input.members.length}.`,
      attendeeIds: ids,
      createdBy: userId,
    });
    return c.id;
  });
}

export async function activeCommittees(tenantId: string, kinds?: Kind[]) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const list = await tx
      .select()
      .from(committee)
      .where(
        and(
          eq(committee.tenantId, tenantId),
          eq(committee.status, "active"),
          kinds ? inArray(committee.kind, kinds) : undefined,
        ),
      )
      .orderBy(asc(committee.kind));
    const members = list.length
      ? await tx
          .select({ m: committeeMember, name: worker.fullName })
          .from(committeeMember)
          .innerJoin(worker, eq(worker.id, committeeMember.workerId))
          .where(
            and(
              inArray(
                committeeMember.committeeId,
                list.map((c) => c.id),
              ),
              eq(committeeMember.active, true),
            ),
          )
      : [];
    return list.map((c) => ({
      ...c,
      members: members
        .filter((x) => x.m.committeeId === c.id)
        .map((x) => ({ ...x.m, name: x.name })),
    }));
  });
}

export async function addMinutes(tenantId: string, userId: string, input: MinutesInput) {
  const d = minutesSchema.parse(input);
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [c] = await tx
      .select({ id: committee.id })
      .from(committee)
      .where(and(eq(committee.id, d.committeeId), eq(committee.tenantId, tenantId)));
    if (!c) throw new CommitteeError("Comité no encontrado");
    const [m] = await tx
      .insert(committeeMinutes)
      .values({
        tenantId,
        committeeId: d.committeeId,
        kind: "meeting",
        date: d.date,
        agenda: d.agenda,
        content: d.content,
        attendeeIds: d.attendeeIds,
        createdBy: userId,
      })
      .returning({ id: committeeMinutes.id });
    if (d.commitments.length)
      await tx.insert(committeeCommitment).values(
        d.commitments.map((x) => ({
          tenantId,
          minutesId: m.id,
          description: x.description,
          responsibleName: x.responsibleName,
          dueDate: x.dueDate,
        })),
      );
    return m.id;
  });
}

export async function closeCommitment(tenantId: string, userId: string, id: string, note: string) {
  if (!note.trim()) throw new CommitteeError("Describe cómo se cumplió el compromiso");
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const r = await tx
      .update(committeeCommitment)
      .set({ status: "done", closureNote: note.trim(), closedAt: new Date() })
      .where(and(eq(committeeCommitment.id, id), eq(committeeCommitment.tenantId, tenantId)))
      .returning({ id: committeeCommitment.id });
    if (!r.length) throw new CommitteeError("Compromiso no encontrado");
  });
}

/** Estado de un comité: renovación del periodo, reuniones mensuales faltantes y compromisos abiertos. */
export async function committeeStatus(tenantId: string, committeeId: string) {
  const [warn] = await Promise.all([getParameter("comite.alerta_renovacion_dias", 60)]);
  return withTenant(ctxOf(tenantId), async (tx) => {
    const [c] = await tx
      .select()
      .from(committee)
      .where(and(eq(committee.id, committeeId), eq(committee.tenantId, tenantId)));
    if (!c) return null;
    const minutes = await tx
      .select()
      .from(committeeMinutes)
      .where(eq(committeeMinutes.committeeId, committeeId))
      .orderBy(desc(committeeMinutes.date));
    const commitments = minutes.length
      ? await tx
          .select()
          .from(committeeCommitment)
          .where(
            inArray(
              committeeCommitment.minutesId,
              minutes.map((m) => m.id),
            ),
          )
      : [];
    const t = todayYmd();
    return {
      committee: c,
      minutes,
      commitments,
      renewal: renewalState(c.periodEnd, t, warn),
      gaps: meetingGaps(
        minutes.filter((m) => m.kind === "meeting").map((m) => m.date),
        c.periodStart,
        t,
      ),
      openCommitments: commitments.filter((x) => x.status === "open").length,
      overdueCommitments: commitments.filter(
        (x) => x.status === "open" && x.dueDate && x.dueDate < t,
      ).length,
    };
  });
}

// ---------- Elecciones ----------

export async function createElection(tenantId: string, userId: string, input: ElectionInput) {
  const d = electionSchema.parse(input);
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const open = await tx
      .select({ id: election.id })
      .from(election)
      .where(and(eq(election.tenantId, tenantId), ne(election.status, "closed")));
    if (open.length) throw new CommitteeError("Ya hay una elección en curso");
    const [e] = await tx
      .insert(election)
      .values({ tenantId, ...d, status: "registration", registrationOpensOn: todayYmd() })
      .returning({ id: election.id });
    return e.id;
  });
}

export async function addCandidate(
  tenantId: string,
  userId: string,
  electionId: string,
  workerId: string,
) {
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [e] = await tx
      .select()
      .from(election)
      .where(and(eq(election.id, electionId), eq(election.tenantId, tenantId)));
    if (!e) throw new CommitteeError("Elección no encontrada");
    if (e.status !== "registration")
      throw new CommitteeError("La inscripción de candidatos ya cerró");
    if (!(await eligibleVoters(tx, tenantId)).some((w) => w.id === workerId))
      throw new CommitteeError("Solo pueden postularse trabajadores activos de la empresa");
    const r = await tx
      .insert(electionCandidate)
      .values({ tenantId, electionId, workerId })
      .onConflictDoNothing()
      .returning({ id: electionCandidate.id });
    if (!r.length) throw new CommitteeError("Ya está inscrito");
  });
}

/**
 * Abre la votación: genera un token individual por trabajador activo (se devuelve una sola vez; en base queda su hash).
 * Los que tienen correo reciben su enlace por email; para el resto se imprime/entrega desde el listado devuelto.
 */
export async function openVoting(tenantId: string, userId: string, electionId: string) {
  await assertWritable(tenantId);
  const issued = await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [e] = await tx
      .select()
      .from(election)
      .where(and(eq(election.id, electionId), eq(election.tenantId, tenantId)));
    if (!e) throw new CommitteeError("Elección no encontrada");
    if (e.status !== "registration") throw new CommitteeError("La votación ya se abrió");
    const cands = await tx
      .select({ id: electionCandidate.id })
      .from(electionCandidate)
      .where(eq(electionCandidate.electionId, electionId));
    if (cands.length < e.principalSeats)
      throw new CommitteeError(`Se necesitan al menos ${e.principalSeats} candidatos inscritos`);
    const voters = await eligibleVoters(tx, tenantId);
    if (!voters.length) throw new CommitteeError("No hay trabajadores activos que voten");
    const out = voters.map((w) => ({
      workerId: w.id,
      name: w.fullName,
      email: w.email,
      token: newVoteToken(),
    }));
    await tx.insert(electionVoter).values(
      out.map((v) => ({
        tenantId,
        electionId,
        workerId: v.workerId,
        tokenHash: hashToken(v.token),
      })),
    );
    await tx
      .update(election)
      .set({ status: "voting", updatedAt: new Date() })
      .where(eq(election.id, electionId));
    return out;
  });
  const voteBase = await tenantUrl(tenantId, "/votar/");
  const links = issued.map((v) => ({
    name: v.name,
    email: v.email,
    url: `${voteBase}${v.token}`,
  }));
  await Promise.all(
    links
      .filter((l) => l.email)
      .map((l) =>
        sendMail({
          to: l.email!,
          subject: "Tu voto para la elección del comité",
          html: `<p>Hola ${l.name},</p><p>Ya puedes votar en la elección de los representantes de los trabajadores. Tu enlace es personal y de un solo uso: <a href="${l.url}">${l.url}</a></p>`,
        }).catch(() => undefined),
      ),
  );
  return links;
}

/** Datos para la pantalla pública de votación: solo si el token es válido, sin usar y la elección está en votación. */
export async function ballotByToken(tenantId: string, token: string) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const [v] = await tx
      .select()
      .from(electionVoter)
      .where(
        and(eq(electionVoter.tenantId, tenantId), eq(electionVoter.tokenHash, hashToken(token))),
      );
    if (!v) return null;
    const [e] = await tx.select().from(election).where(eq(election.id, v.electionId));
    if (!e || e.status !== "voting") return null;
    const today = todayYmd();
    if (e.votingClosesOn && today > e.votingClosesOn) return null;
    const cands = await tx
      .select({ id: electionCandidate.id, name: worker.fullName })
      .from(electionCandidate)
      .innerJoin(worker, eq(worker.id, electionCandidate.workerId))
      .where(eq(electionCandidate.electionId, e.id))
      .orderBy(asc(worker.fullName));
    return {
      kind: e.kind,
      principalSeats: e.principalSeats,
      candidates: cands,
      alreadyVoted: Boolean(v.votedOn),
      voterId: v.id,
      electionId: e.id,
    };
  });
}

/**
 * Deposita el voto: marca al votante (solo el día) y crea una papeleta anónima en la misma transacción. Una persona vota una
 * sola vez; se puede elegir hasta `principalSeats` candidatos distintos (un voto por candidato).
 */
export async function castVote(tenantId: string, token: string, candidateIds: string[]) {
  const info = await ballotByToken(tenantId, token);
  if (!info)
    throw new CommitteeError("Este enlace de votación no es válido o la votación no está abierta.");
  if (info.alreadyVoted) throw new CommitteeError("Ya votaste en esta elección.");
  const unique = [...new Set(candidateIds)];
  if (unique.length === 0 || unique.length > info.principalSeats)
    throw new CommitteeError(`Elige entre 1 y ${info.principalSeats} candidatos.`);
  if (!unique.every((id) => info.candidates.some((c) => c.id === id)))
    throw new CommitteeError("Candidato inválido.");
  await withTenant(ctxOf(tenantId), async (tx) => {
    // Marca primero con condición: dos envíos simultáneos no pueden votar dos veces.
    const r = await tx
      .update(electionVoter)
      .set({ votedOn: todayYmd() })
      .where(and(eq(electionVoter.id, info.voterId), isNull(electionVoter.votedOn)))
      .returning({ id: electionVoter.id });
    if (!r.length) throw new CommitteeError("Ya votaste en esta elección.");
    await tx
      .insert(electionBallot)
      .values(
        unique.map((candidateId) => ({ tenantId, electionId: info.electionId, candidateId })),
      );
  });
}

/** Cierra la votación y hace el escrutinio automático. Si hay empate en un corte, queda pendiente de resolver. */
export async function closeVoting(tenantId: string, userId: string, electionId: string) {
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [e] = await tx
      .select()
      .from(election)
      .where(and(eq(election.id, electionId), eq(election.tenantId, tenantId)));
    if (!e) throw new CommitteeError("Elección no encontrada");
    if (e.status !== "voting") throw new CommitteeError("La elección no está en votación");
    const cands = await tx
      .select({ id: electionCandidate.id, name: worker.fullName })
      .from(electionCandidate)
      .innerJoin(worker, eq(worker.id, electionCandidate.workerId))
      .where(eq(electionCandidate.electionId, electionId));
    const ballots = await tx
      .select({ c: electionBallot.candidateId })
      .from(electionBallot)
      .where(eq(electionBallot.electionId, electionId));
    const voters = await tx
      .select({ votedOn: electionVoter.votedOn })
      .from(electionVoter)
      .where(eq(electionVoter.electionId, electionId));
    const s = scrutinize(
      cands.map((c) => ({
        id: c.id,
        name: c.name,
        votes: ballots.filter((b) => b.c === c.id).length,
      })),
      e.principalSeats,
      e.alternateSeats,
    );
    const result = { ...s, eligible: voters.length, voted: voters.filter((v) => v.votedOn).length };
    await tx
      .update(election)
      .set({ status: "closed", result, closedAt: new Date(), updatedAt: new Date() })
      .where(eq(election.id, electionId));
    return result;
  });
}

/** Resuelve un empate (p. ej. por sorteo): `order` lista los candidatos en el orden final; queda registrada la nota. */
export async function resolveTie(
  tenantId: string,
  userId: string,
  electionId: string,
  order: string[],
  note: string,
) {
  if (!note.trim()) throw new CommitteeError("Describe cómo se resolvió el empate");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [e] = await tx
      .select()
      .from(election)
      .where(and(eq(election.id, electionId), eq(election.tenantId, tenantId)));
    if (!e?.result?.tie) throw new CommitteeError("La elección no tiene un empate por resolver");
    const ids = e.result.rows.map((r) => r.candidateId);
    if (order.length !== ids.length || !ids.every((id) => order.includes(id)))
      throw new CommitteeError("El orden debe incluir a todos los candidatos");
    const votes = new Map(e.result.rows.map((r) => [r.candidateId, r]));
    const rows = order.map((id, i) => ({
      ...votes.get(id)!,
      seat: (i < e.principalSeats
        ? "principal"
        : i < e.principalSeats + e.alternateSeats
          ? "alternate"
          : null) as "principal" | "alternate" | null,
    }));
    // El orden elegido no puede contradecir los votos: nadie con menos votos queda por encima de quien tiene más.
    for (let i = 0; i < rows.length - 1; i++)
      if (rows[i].votes < rows[i + 1].votes)
        throw new CommitteeError("El orden contradice los votos obtenidos");
    await tx
      .update(election)
      .set({
        result: { ...e.result, rows, tie: false },
        resolutionNote: note.trim(),
        updatedAt: new Date(),
      })
      .where(eq(election.id, electionId));
  });
}

export async function getElection(tenantId: string, id: string) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const [e] = await tx
      .select()
      .from(election)
      .where(and(eq(election.id, id), eq(election.tenantId, tenantId)));
    if (!e) return null;
    const candidates = await tx
      .select({
        id: electionCandidate.id,
        workerId: electionCandidate.workerId,
        name: worker.fullName,
      })
      .from(electionCandidate)
      .innerJoin(worker, eq(worker.id, electionCandidate.workerId))
      .where(eq(electionCandidate.electionId, id))
      .orderBy(asc(worker.fullName));
    const voters = await tx
      .select({ votedOn: electionVoter.votedOn })
      .from(electionVoter)
      .where(eq(electionVoter.electionId, id));
    return {
      election: e,
      candidates,
      eligible: voters.length,
      voted: voters.filter((v) => v.votedOn).length,
    };
  });
}

export async function listElections(tenantId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(election)
      .where(eq(election.tenantId, tenantId))
      .orderBy(desc(election.createdAt)),
  );
}

/** Aplica el resultado: conforma el comité con los elegidos (representantes de los trabajadores) y los del empleador. */
export async function applyElection(
  tenantId: string,
  userId: string,
  electionId: string,
  employerReps: { principal: string[]; alternate: string[] },
  periodStart: string,
) {
  const e = await getElection(tenantId, electionId);
  if (!e) throw new CommitteeError("Elección no encontrada");
  if (e.election.status !== "closed" || !e.election.result)
    throw new CommitteeError("Cierra la votación primero");
  if (e.election.result.tie)
    throw new CommitteeError("Resuelve el empate antes de conformar el comité");
  if (e.election.appliedCommitteeId) throw new CommitteeError("El resultado ya se aplicó");
  const byCandidate = new Map(e.candidates.map((c) => [c.id, c.workerId]));
  const members: MemberDraft[] = [
    ...e.election.result.rows
      .filter((r) => r.seat)
      .map((r): MemberDraft => ({
        workerId: byCandidate.get(r.candidateId)!,
        representation: "workers",
        seat: r.seat!,
      })),
    ...employerReps.principal.map((workerId): MemberDraft => ({
      workerId,
      representation: "employer",
      seat: "principal",
    })),
    ...employerReps.alternate.map((workerId): MemberDraft => ({
      workerId,
      representation: "employer",
      seat: "alternate",
    })),
  ];
  const id = await conformCommittee(tenantId, userId, {
    kind: e.election.kind as Kind,
    workCenterId: e.election.workCenterId,
    periodStart,
    members,
  });
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .update(election)
      .set({ appliedCommitteeId: id, updatedAt: new Date() })
      .where(eq(election.id, electionId)),
  );
  return id;
}
