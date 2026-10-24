import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, schema, withPlatform } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { devOutbox } from "@/core/mail";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import { createWorker } from "@/modules/workers/service";
import {
  activeCommittees,
  addCandidate,
  addMinutes,
  applyElection,
  ballotByToken,
  castVote,
  closeCommitment,
  closeVoting,
  committeeStatus,
  conformCommittee,
  createElection,
  getElection,
  openVoting,
  resolveTie,
  suggestedKind,
} from "./service";

pointToTestDb();
let n = 0;
const mk = async (workers = 12) => {
  const t = await createTenantWithSubscription(`cm-${++n}`);
  await withPlatform({ actorId: "t", action: "t", tenantId: t.id, audit: false }, async (tx) => {
    const { eq } = await import("drizzle-orm");
    await tx.update(schema.tenant).set({ workersCount: workers }).where(eq(schema.tenant.id, t.id));
  });
  return t.id;
};
const people = async (t: string, count: number, withEmail = false) => {
  const ids: string[] = [];
  for (let i = 0; i < count; i++)
    ids.push(
      await createWorker(t, "u", {
        kind: "employee",
        idType: "13",
        idNumber: String(10_000_000 + i + n * 100),
        fullName: `Persona ${String.fromCharCode(65 + i)}`,
        startDate: "2024-01-01",
        email: withEmail ? `p${i}@x.co` : "",
      }),
    );
  return ids;
};
const tokenOf = (links: { url: string }[], i: number) => links[i].url.split("/votar/")[1];

describe.skipIf(!hasTestDb)("comités y elecciones", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("sugiere COPASST o Vigía según el tamaño", async () => {
    expect(await suggestedKind(await mk(12))).toBe("copasst");
    expect(await suggestedKind(await mk(5))).toBe("vigia");
  });

  it("conforma el comité con acta, periodo de 2 años y valida tipo y paridad; la nueva conformación cierra la anterior", async () => {
    const t = await mk(12);
    const [a, b, c, d] = await people(t, 4);
    await expect(
      conformCommittee(t, "u", {
        kind: "vigia",
        periodStart: "2026-01-15",
        members: [
          { workerId: a, representation: "employer", seat: "principal" },
          { workerId: b, representation: "workers", seat: "principal" },
        ],
      }),
    ).rejects.toThrow(/corresponde COPASST/);
    await expect(
      conformCommittee(t, "u", {
        kind: "copasst",
        periodStart: "2026-01-15",
        members: [{ workerId: a, representation: "employer", seat: "principal" }],
      }),
    ).rejects.toThrow(/al menos un principal/);
    const id = await conformCommittee(t, "u", {
      kind: "copasst",
      periodStart: "2026-01-15",
      members: [
        { workerId: a, representation: "employer", seat: "principal", role: "presidente" },
        { workerId: b, representation: "workers", seat: "principal" },
        { workerId: c, representation: "workers", seat: "alternate" },
      ],
    });
    const [cm] = await activeCommittees(t);
    expect(cm).toMatchObject({ id, periodEnd: "2028-01-15" });
    expect(cm.members).toHaveLength(3);
    const st = (await committeeStatus(t, id))!;
    expect(st.minutes[0].kind).toBe("formation");
    const id2 = await conformCommittee(t, "u", {
      kind: "copasst",
      periodStart: "2028-01-20",
      members: [
        { workerId: c, representation: "employer", seat: "principal" },
        { workerId: d, representation: "workers", seat: "principal" },
      ],
    });
    expect((await activeCommittees(t)).map((x) => x.id)).toEqual([id2]);
  });

  it("actas mensuales: detecta meses sin reunión y los compromisos se cierran con nota", async () => {
    const t = await mk(12);
    const [a, b] = await people(t, 2);
    const id = await conformCommittee(t, "u", {
      kind: "copasst",
      periodStart: "2026-01-15",
      members: [
        { workerId: a, representation: "employer", seat: "principal" },
        { workerId: b, representation: "workers", seat: "principal" },
      ],
    });
    await addMinutes(t, "u", {
      committeeId: id,
      date: "2026-02-10",
      content: "Se revisó el plan de trabajo y las inspecciones.",
      attendeeIds: [a, b],
      commitments: [
        { description: "Inspeccionar extintores", responsibleName: "Ana", dueDate: "2026-03-01" },
      ],
    });
    const st = (await committeeStatus(t, id))!;
    expect(st.gaps.missing).not.toContain("2026-02");
    expect(st.gaps.missing).toContain("2026-03");
    expect(st.openCommitments).toBe(1);
    expect(st.overdueCommitments).toBe(1);
    await expect(closeCommitment(t, "u", st.commitments[0].id, " ")).rejects.toThrow(/Describe/);
    await closeCommitment(t, "u", st.commitments[0].id, "Se inspeccionaron 12 extintores");
    expect((await committeeStatus(t, id))!.openCommitments).toBe(0);
  });

  it("elección completa: candidatos, voto secreto de un solo uso, escrutinio y conformación del comité", async () => {
    const t = await mk(12);
    const ids = await people(t, 6, true);
    const e = await createElection(t, "u", {
      kind: "copasst",
      principalSeats: 1,
      alternateSeats: 1,
      votingOpensOn: "2026-01-01",
      votingClosesOn: "2099-12-31",
    });
    await expect(
      createElection(t, "u", {
        kind: "copasst",
        principalSeats: 1,
        alternateSeats: 1,
        votingOpensOn: "2026-01-01",
        votingClosesOn: "2099-12-31",
      }),
    ).rejects.toThrow(/en curso/);
    await expect(openVoting(t, "u", e)).rejects.toThrow(/al menos 1 candidatos/);
    for (const w of ids.slice(0, 3)) await addCandidate(t, "u", e, w);
    await expect(addCandidate(t, "u", e, ids[0])).rejects.toThrow(/Ya está inscrito/);
    devOutbox.length = 0;
    const links = await openVoting(t, "u", e);
    expect(links).toHaveLength(6);
    expect(devOutbox).toHaveLength(6);
    const cands = (await getElection(t, e))!.candidates;
    const [c1, c2, c3] = cands;
    // 4 votos para c1, 2 para c2, 0 para c3
    for (let i = 0; i < 4; i++) await castVote(t, tokenOf(links, i), [c1.id]);
    for (let i = 4; i < 6; i++) await castVote(t, tokenOf(links, i), [c2.id]);
    await expect(castVote(t, tokenOf(links, 0), [c1.id])).rejects.toThrow(/Ya votaste/);
    await expect(castVote(t, "f".repeat(48), [c1.id])).rejects.toThrow(/no es válido/);
    expect(await ballotByToken(t, "f".repeat(48))).toBeNull();
    // Voto secreto: las papeletas no guardan quién votó ni la hora.
    const cols = await withPlatform(
      { actorId: "t", action: "t", tenantId: t, audit: false },
      async (tx) => {
        const { sql } = await import("drizzle-orm");
        return tx.execute(
          sql`select column_name from information_schema.columns where table_name = 'election_ballot'`,
        );
      },
    );
    expect(JSON.stringify(cols.rows)).not.toMatch(/worker|voter|created|at"/);
    const res = await closeVoting(t, "u", e);
    expect(res).toMatchObject({ totalVotes: 6, eligible: 6, voted: 6, tie: false });
    expect(res.rows.map((r) => [r.candidateId, r.seat])).toEqual([
      [c1.id, "principal"],
      [c2.id, "alternate"],
      [c3.id, null],
    ]);
    await expect(castVote(t, tokenOf(links, 0), [c1.id])).rejects.toThrow();
    const employer = ids[5];
    const cid = await applyElection(
      t,
      "u",
      e,
      { principal: [employer], alternate: [] },
      "2026-02-01",
    );
    const [cm] = await activeCommittees(t);
    expect(cm.id).toBe(cid);
    expect(
      cm.members
        .filter((m) => m.representation === "workers")
        .map((m) => m.workerId)
        .sort(),
    ).toEqual([c1.workerId, c2.workerId].sort());
    await expect(
      applyElection(t, "u", e, { principal: [employer], alternate: [] }, "2026-02-01"),
    ).rejects.toThrow(/ya se aplicó/);
  });

  it("empate: no se aplica hasta resolverlo y el orden no puede contradecir los votos", async () => {
    const t = await mk(12);
    const ids = await people(t, 4);
    const e = await createElection(t, "u", {
      kind: "copasst",
      principalSeats: 1,
      alternateSeats: 0,
      votingOpensOn: "2026-01-01",
      votingClosesOn: "2099-12-31",
    });
    await addCandidate(t, "u", e, ids[0]);
    await addCandidate(t, "u", e, ids[1]);
    const links = await openVoting(t, "u", e);
    const [c1, c2] = (await getElection(t, e))!.candidates;
    await castVote(t, tokenOf(links, 0), [c1.id]);
    await castVote(t, tokenOf(links, 1), [c2.id]);
    const res = await closeVoting(t, "u", e);
    expect(res.tie).toBe(true);
    await expect(
      applyElection(t, "u", e, { principal: [ids[3]], alternate: [] }, "2026-02-01"),
    ).rejects.toThrow(/empate/);
    await expect(resolveTie(t, "u", e, [c2.id, c1.id], "")).rejects.toThrow(/Describe/);
    await resolveTie(t, "u", e, [c2.id, c1.id], "Sorteo ante el comité de convivencia y testigos");
    const ok = await applyElection(t, "u", e, { principal: [ids[3]], alternate: [] }, "2026-02-01");
    expect(ok).toBeTruthy();
    expect(
      (await activeCommittees(t))[0].members.find((m) => m.representation === "workers")?.workerId,
    ).toBe(c2.workerId);
  });

  it("aísla elecciones y votos por empresa; no se vota más de lo permitido", async () => {
    const a = await mk(12);
    const b = await mk(12);
    const ids = await people(a, 3);
    const e = await createElection(a, "u", {
      kind: "copasst",
      principalSeats: 1,
      alternateSeats: 0,
      votingOpensOn: "2026-01-01",
      votingClosesOn: "2099-12-31",
    });
    await addCandidate(a, "u", e, ids[0]);
    await addCandidate(a, "u", e, ids[1]);
    const links = await openVoting(a, "u", e);
    const [c1, c2] = (await getElection(a, e))!.candidates;
    expect(await getElection(b, e)).toBeNull();
    await expect(castVote(b, tokenOf(links, 0), [c1.id])).rejects.toThrow(/no es válido/);
    await expect(castVote(a, tokenOf(links, 0), [c1.id, c2.id])).rejects.toThrow(/entre 1 y 1/);
  });
});
