import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, updatedAt } from "./_helpers";
import { tenant, workCenter } from "./tenancy";
import { worker } from "./workers";

/**
 * Comité de la empresa: COPASST, Vigía SST o Comité de Convivencia Laboral (CCL; uno por centro de trabajo si aplica).
 * Periodo de 2 años desde la conformación (Decreto 1295 de 1994, art. 63; Resolución 2013 de 1986 — TODO-NORMA validar).
 */
export const committee = pgTable(
  "committee",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    /** copasst | vigia | ccl */
    kind: text().notNull(),
    workCenterId: uuid().references(() => workCenter.id),
    periodStart: date({ mode: "string" }).notNull(),
    periodEnd: date({ mode: "string" }).notNull(),
    /** active | closed (reemplazado por una nueva conformación) */
    status: text().notNull().default("active"),
    regulations: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("committee_tenant_idx").on(t.tenantId, t.kind, t.status)],
);

export const committeeMember = pgTable(
  "committee_member",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    committeeId: uuid()
      .notNull()
      .references(() => committee.id),
    workerId: uuid()
      .notNull()
      .references(() => worker.id),
    /** employer | workers */
    representation: text().notNull(),
    /** principal | alternate */
    seat: text().notNull().default("principal"),
    /** presidente | secretario | miembro */
    role: text().notNull().default("miembro"),
    active: boolean().notNull().default(true),
    /** CCL: acuerdo de confidencialidad firmado. */
    confidentialityAt: timestamp({ withTimezone: true }),
    confidentialitySignature: text(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("committee_member_uq").on(t.committeeId, t.workerId),
    index("committee_member_worker_idx").on(t.workerId),
  ],
);

/** Acta (conformación o reunión) con compromisos. */
export const committeeMinutes = pgTable(
  "committee_minutes",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    committeeId: uuid()
      .notNull()
      .references(() => committee.id),
    /** formation | meeting */
    kind: text().notNull(),
    date: date({ mode: "string" }).notNull(),
    agenda: text(),
    content: text().notNull(),
    attendeeIds: jsonb().$type<string[]>().notNull().default([]),
    createdBy: text(),
    createdAt: createdAt(),
  },
  (t) => [index("committee_minutes_idx").on(t.committeeId, t.date)],
);

export const committeeCommitment = pgTable(
  "committee_commitment",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    minutesId: uuid()
      .notNull()
      .references(() => committeeMinutes.id),
    description: text().notNull(),
    responsibleName: text(),
    dueDate: date({ mode: "string" }),
    /** open | done */
    status: text().notNull().default("open"),
    closureNote: text(),
    closedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("committee_commitment_idx").on(t.tenantId, t.status)],
);

/** Elección electrónica de los representantes de los trabajadores (voto secreto, un voto por trabajador). */
export const election = pgTable(
  "election",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    /** copasst | vigia | ccl */
    kind: text().notNull(),
    workCenterId: uuid().references(() => workCenter.id),
    principalSeats: integer().notNull(),
    alternateSeats: integer().notNull(),
    /** draft | registration | voting | closed */
    status: text().notNull().default("draft"),
    registrationOpensOn: date({ mode: "string" }),
    votingOpensOn: date({ mode: "string" }),
    votingClosesOn: date({ mode: "string" }),
    /** Resultado del escrutinio: [{candidateId, name, votes, seat}] y empates. */
    result: jsonb().$type<{
      rows: {
        candidateId: string;
        name: string;
        votes: number;
        seat: "principal" | "alternate" | null;
      }[];
      tie: boolean;
      totalVotes: number;
      eligible: number;
    }>(),
    resolutionNote: text(),
    closedAt: timestamp({ withTimezone: true }),
    appliedCommitteeId: uuid().references(() => committee.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("election_tenant_idx").on(t.tenantId, t.status)],
);

export const electionCandidate = pgTable(
  "election_candidate",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    electionId: uuid()
      .notNull()
      .references(() => election.id),
    workerId: uuid()
      .notNull()
      .references(() => worker.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("election_candidate_uq").on(t.electionId, t.workerId)],
);

/** Quién puede votar y si ya votó (sin registrar por quién): el token se guarda solo como hash. */
export const electionVoter = pgTable(
  "election_voter",
  {
    id: id(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    electionId: uuid()
      .notNull()
      .references(() => election.id),
    workerId: uuid()
      .notNull()
      .references(() => worker.id),
    tokenHash: text().notNull(),
    /** Solo el día: evita correlacionar la hora del voto con la papeleta. */
    votedOn: date({ mode: "string" }),
  },
  (t) => [
    uniqueIndex("election_voter_uq").on(t.electionId, t.workerId),
    uniqueIndex("election_voter_token_uq").on(t.tokenHash),
  ],
);

/** Papeleta anónima: sin vínculo con el votante, sin hora y con id aleatorio (no v7) para que el orden no la delate. */
export const electionBallot = pgTable(
  "election_ballot",
  {
    id: uuid().primaryKey().defaultRandom(),
    tenantId: uuid()
      .notNull()
      .references(() => tenant.id),
    electionId: uuid()
      .notNull()
      .references(() => election.id),
    candidateId: uuid()
      .notNull()
      .references(() => electionCandidate.id),
  },
  (t) => [index("election_ballot_idx").on(t.electionId, t.candidateId)],
);
