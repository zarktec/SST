import "server-only";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { schema, withTenant, type Tx } from "@/core/db";
import { decrypt, encrypt } from "@/core/crypto/envelope";
import { assertWritable } from "@/core/plans/limits";
import { isValidSignature } from "@/core/signature";
import { conformCommittee } from "@/modules/committees/service";
import type { MemberDraft } from "@/modules/committees/rules";
import { getParameter } from "@/modules/platform/catalogs/service";
import {
  DEFAULT_STAGE_DAYS,
  complaintSchema,
  dueAfter,
  harassmentSchema,
  ineligibleForCommittee,
  isOverdue,
  nextStages,
  validateCclSize,
  type ComplaintInput,
  type HarassmentInput,
  type Stage,
} from "./rules";

const {
  cclComplaint,
  cclComplaintEvent,
  harassmentReport,
  committee,
  committeeMember,
  worker,
  sensitiveAccessLog,
} = schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });
const aadCcl = (tenantId: string) => `ccl:${tenantId}`;
const aadHar = (tenantId: string) => `harassment:${tenantId}`;

export class ConvivenciaError extends Error {}
/** Acceso denegado a información confidencial (no es miembro activo del comité o no firmó la confidencialidad). */
export class AccessDeniedError extends Error {
  constructor(message = "No tienes acceso a esta información confidencial") {
    super(message);
  }
}

/** Copia sin los campos indicados (para no exponer columnas cifradas). */
function omit<T extends object, K extends keyof T>(o: T, ...keys: K[]): Omit<T, K> {
  const c = { ...o };
  for (const k of keys) delete c[k];
  return c;
}

export type Actor = { userId: string; email: string };

async function workerByEmail(tx: Tx, tenantId: string, email: string) {
  const [w] = await tx
    .select()
    .from(worker)
    .where(
      and(
        eq(worker.tenantId, tenantId),
        isNull(worker.deletedAt),
        sql`lower(${worker.email}) = lower(${email})`,
      ),
    );
  return w ?? null;
}

async function logAccess(
  tx: Tx,
  tenantId: string,
  actor: Actor,
  entity: string,
  entityId: string | null,
  reason: string,
) {
  await tx
    .insert(sensitiveAccessLog)
    .values({ tenantId, actorId: actor.userId, entity, entityId, reason });
}

/** Miembro activo de un CCL vigente: se identifica por el correo de su ficha de trabajador. */
export async function cclMembership(tenantId: string, email: string) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const w = await workerByEmail(tx, tenantId, email);
    if (!w) return null;
    const rows = await tx
      .select({ m: committeeMember, c: committee })
      .from(committeeMember)
      .innerJoin(committee, eq(committee.id, committeeMember.committeeId))
      .where(
        and(
          eq(committeeMember.tenantId, tenantId),
          eq(committeeMember.workerId, w.id),
          eq(committeeMember.active, true),
          eq(committee.kind, "ccl"),
          eq(committee.status, "active"),
        ),
      );
    return rows.length
      ? {
          workerId: w.id,
          memberships: rows.map((r) => ({
            memberId: r.m.id,
            committeeId: r.c.id,
            confidentialityAt: r.m.confidentialityAt,
          })),
        }
      : null;
  });
}

async function assertCclAccess(tx: Tx, tenantId: string, actor: Actor) {
  const w = await workerByEmail(tx, tenantId, actor.email);
  if (!w) throw new AccessDeniedError();
  const rows = await tx
    .select({ m: committeeMember })
    .from(committeeMember)
    .innerJoin(committee, eq(committee.id, committeeMember.committeeId))
    .where(
      and(
        eq(committeeMember.tenantId, tenantId),
        eq(committeeMember.workerId, w.id),
        eq(committeeMember.active, true),
        eq(committee.kind, "ccl"),
        eq(committee.status, "active"),
      ),
    );
  if (!rows.length)
    throw new AccessDeniedError(
      "Solo los miembros activos del Comité de Convivencia pueden ver las quejas",
    );
  if (!rows.some((r) => r.m.confidentialityAt))
    throw new AccessDeniedError(
      "Firma primero tu acuerdo de confidencialidad como miembro del comité",
    );
  return w;
}

/** Conforma el CCL (central o de una sede) validando tamaño mínimo y que ningún integrante tenga quejas en el último año. */
export async function conformCcl(
  tenantId: string,
  userId: string,
  input: {
    workCenterId?: string | null;
    periodStart: string;
    members: MemberDraft[];
    regulations?: string;
  },
) {
  const [principal, alternate] = await Promise.all([
    getParameter("ccl.principales_min_por_parte", 1),
    getParameter("ccl.suplentes_min_por_parte", 1),
  ]);
  const count = (rep: string, seat: string) =>
    input.members.filter((m) => m.representation === rep && m.seat === seat).length;
  const sizeErrors = validateCclSize(
    {
      employerPrincipal: count("employer", "principal"),
      workersPrincipal: count("workers", "principal"),
      employerAlternate: count("employer", "alternate"),
      workersAlternate: count("workers", "alternate"),
    },
    { principal, alternate },
  );
  if (sizeErrors.length) throw new ConvivenciaError(sizeErrors.join(". "));
  return conformCommittee(
    tenantId,
    userId,
    { kind: "ccl", ...input },
    {
      extraValidation: async (tx, members) => {
        const since = new Date(Date.now() - 365 * 86_400_000);
        const complaints = await tx
          .select({
            complainantWorkerId: cclComplaint.complainantWorkerId,
            respondentWorkerId: cclComplaint.respondentWorkerId,
            receivedAt: cclComplaint.receivedAt,
          })
          .from(cclComplaint)
          .where(and(eq(cclComplaint.tenantId, tenantId), gte(cclComplaint.receivedAt, since)));
        const bad = ineligibleForCommittee(
          members.map((m) => m.workerId),
          complaints,
          new Date(),
        );
        if (!bad.length) return [];
        const names = await tx
          .select({ name: worker.fullName, id: worker.id })
          .from(worker)
          .where(and(eq(worker.tenantId, tenantId)));
        return [
          `No pueden integrar el comité quienes hayan sido denunciados o víctimas de acoso laboral en el último año: ${bad.map((b) => names.find((n) => n.id === b)?.name ?? b).join(", ")}`,
        ];
      },
    },
  );
}

/** El miembro firma su acuerdo de confidencialidad (firma táctil). Sin firma no accede a las quejas. */
export async function signConfidentiality(tenantId: string, actor: Actor, signature: string) {
  if (!isValidSignature(signature)) throw new ConvivenciaError("La firma no es válida");
  await withTenant(ctxOf(tenantId, actor.userId), async (tx) => {
    const w = await workerByEmail(tx, tenantId, actor.email);
    if (!w) throw new AccessDeniedError();
    const r = await tx
      .update(committeeMember)
      .set({ confidentialityAt: new Date(), confidentialitySignature: signature })
      .where(
        and(
          eq(committeeMember.tenantId, tenantId),
          eq(committeeMember.workerId, w.id),
          eq(committeeMember.active, true),
          sql`${committeeMember.committeeId} in (select id from committee where tenant_id = ${tenantId} and kind = 'ccl' and status = 'active')`,
        ),
      )
      .returning({ id: committeeMember.id });
    if (!r.length) throw new AccessDeniedError("No eres miembro activo del Comité de Convivencia");
  });
}

async function stageDays() {
  const [citacion, reunion, seguimiento] = await Promise.all([
    getParameter("ccl.plazo_citacion_dias", DEFAULT_STAGE_DAYS.citacion),
    getParameter("ccl.plazo_reunion_dias", DEFAULT_STAGE_DAYS.reunion),
    getParameter("ccl.plazo_seguimiento_dias", DEFAULT_STAGE_DAYS.seguimiento),
  ]);
  return { citacion, reunion, seguimiento };
}

/**
 * Radica una queja de acoso laboral. Cualquier persona autenticada de la empresa puede hacerlo; puede ser anónima (entonces no se
 * guarda quién es). Se asigna al CCL de la sede o, si no hay, al central.
 */
export async function submitComplaint(
  tenantId: string,
  email: string | null,
  input: ComplaintInput,
) {
  const d = complaintSchema.parse(input);
  await assertWritable(tenantId);
  const days = await stageDays();
  return withTenant(ctxOf(tenantId), async (tx) => {
    const complainant = !d.anonymous && email ? await workerByEmail(tx, tenantId, email) : null;
    if (d.respondentWorkerId) {
      const [r] = await tx
        .select({ id: worker.id })
        .from(worker)
        .where(and(eq(worker.id, d.respondentWorkerId), eq(worker.tenantId, tenantId)));
      if (!r) throw new ConvivenciaError("Persona no encontrada");
    }
    const active = await tx
      .select()
      .from(committee)
      .where(
        and(
          eq(committee.tenantId, tenantId),
          eq(committee.kind, "ccl"),
          eq(committee.status, "active"),
        ),
      );
    const target =
      active.find((c) => d.workCenterId && c.workCenterId === d.workCenterId) ??
      active.find((c) => !c.workCenterId) ??
      active[0] ??
      null;
    const now = new Date();
    const [c] = await tx
      .insert(cclComplaint)
      .values({
        tenantId,
        committeeId: target?.id ?? null,
        workCenterId: d.workCenterId,
        complainantWorkerId: complainant?.id ?? null,
        respondentWorkerId: d.respondentWorkerId,
        narrativeEncrypted: encrypt(d.narrative, aadCcl(tenantId)),
        receivedAt: now,
        stageDueAt: dueAfter("received", now, days),
      })
      .returning({ id: cclComplaint.id });
    await tx.insert(cclComplaintEvent).values({
      tenantId,
      complaintId: c.id,
      stage: "received",
      actorId: complainant ? `worker:${complainant.id}` : "anonymous",
      at: now,
    });
    return { id: c.id, assignedToCommittee: Boolean(target) };
  });
}

/** Lista (sin relatos) para los miembros activos del CCL. Queda registrada la consulta. */
export async function listComplaints(tenantId: string, actor: Actor) {
  return withTenant(ctxOf(tenantId, actor.userId), async (tx) => {
    await assertCclAccess(tx, tenantId, actor);
    await logAccess(tx, tenantId, actor, "ccl_complaint", null, "listado");
    const rows = await tx
      .select()
      .from(cclComplaint)
      .where(eq(cclComplaint.tenantId, tenantId))
      .orderBy(desc(cclComplaint.receivedAt));
    const now = new Date();
    return rows.map((r) => ({ ...omit(r, "narrativeEncrypted"), overdue: isOverdue(r, now) }));
  });
}

/** Queja completa con relato descifrado e historial. Cada lectura queda en el registro de accesos sensibles. */
export async function getComplaint(tenantId: string, actor: Actor, id: string) {
  return withTenant(ctxOf(tenantId, actor.userId), async (tx) => {
    await assertCclAccess(tx, tenantId, actor);
    const [c] = await tx
      .select()
      .from(cclComplaint)
      .where(and(eq(cclComplaint.id, id), eq(cclComplaint.tenantId, tenantId)));
    if (!c) return null;
    await logAccess(tx, tenantId, actor, "ccl_complaint", id, "lectura");
    const events = await tx
      .select()
      .from(cclComplaintEvent)
      .where(eq(cclComplaintEvent.complaintId, id))
      .orderBy(cclComplaintEvent.at);
    const names = await tx
      .select({ id: worker.id, name: worker.fullName })
      .from(worker)
      .where(eq(worker.tenantId, tenantId));
    const name = (wid: string | null) =>
      wid ? (names.find((n) => n.id === wid)?.name ?? null) : null;
    return {
      complaint: {
        ...c,
        narrativeEncrypted: undefined,
        narrative: decrypt(c.narrativeEncrypted, aadCcl(tenantId)),
        complainantName: name(c.complainantWorkerId),
        respondentName: name(c.respondentWorkerId),
        overdue: isOverdue(c, new Date()),
      },
      events: events.map((e) => ({
        id: e.id,
        stage: e.stage,
        at: e.at,
        actorId: e.actorId,
        note: e.noteEncrypted ? decrypt(e.noteEncrypted, aadCcl(tenantId)) : null,
      })),
      next: nextStages(c.stage as Stage),
    };
  });
}

/** Avanza el trámite a una etapa válida (con nota obligatoria, cifrada); calcula el plazo de la nueva etapa. */
export async function advanceComplaint(
  tenantId: string,
  actor: Actor,
  id: string,
  stage: Stage,
  note: string,
) {
  if (note.trim().length < 3)
    throw new ConvivenciaError("Registra una nota del paso (qué se hizo o decidió)");
  await assertWritable(tenantId);
  const days = await stageDays();
  await withTenant(ctxOf(tenantId, actor.userId), async (tx) => {
    await assertCclAccess(tx, tenantId, actor);
    const [c] = await tx
      .select()
      .from(cclComplaint)
      .where(and(eq(cclComplaint.id, id), eq(cclComplaint.tenantId, tenantId)));
    if (!c) throw new ConvivenciaError("Queja no encontrada");
    if (!nextStages(c.stage as Stage).includes(stage))
      throw new ConvivenciaError("Ese paso no es válido desde la etapa actual");
    const now = new Date();
    const final = nextStages(stage).length === 0;
    await tx
      .update(cclComplaint)
      .set({
        stage,
        stageDueAt: dueAfter(stage, now, days),
        closedAt: final ? now : null,
        updatedAt: now,
      })
      .where(eq(cclComplaint.id, id));
    await tx.insert(cclComplaintEvent).values({
      tenantId,
      complaintId: id,
      stage,
      noteEncrypted: encrypt(note.trim(), aadCcl(tenantId)),
      actorId: actor.userId,
      at: now,
    });
    await logAccess(tx, tenantId, actor, "ccl_complaint", id, `avance:${stage}`);
  });
}

// ---------- Acoso sexual y violencia de género (canal separado, nunca el CCL) ----------

export async function submitHarassmentReport(
  tenantId: string,
  email: string | null,
  input: HarassmentInput,
) {
  const d = harassmentSchema.parse(input);
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId), async (tx) => {
    const w = !d.anonymous && email ? await workerByEmail(tx, tenantId, email) : null;
    const [r] = await tx
      .insert(harassmentReport)
      .values({
        tenantId,
        reporterWorkerId: w?.id ?? null,
        narrativeEncrypted: encrypt(d.narrative, aadHar(tenantId)),
      })
      .returning({ id: harassmentReport.id });
    return r.id;
  });
}

/** La autorización por permiso (módulo `harassment`) la hace quien llama; aquí se registra cada acceso. */
export async function listHarassmentReports(tenantId: string, actor: Actor) {
  return withTenant(ctxOf(tenantId, actor.userId), async (tx) => {
    await logAccess(tx, tenantId, actor, "harassment_report", null, "listado");
    const rows = await tx
      .select()
      .from(harassmentReport)
      .where(eq(harassmentReport.tenantId, tenantId))
      .orderBy(desc(harassmentReport.receivedAt));
    return rows.map((r) => omit(r, "narrativeEncrypted", "noteEncrypted"));
  });
}

export async function getHarassmentReport(tenantId: string, actor: Actor, id: string) {
  return withTenant(ctxOf(tenantId, actor.userId), async (tx) => {
    const [r] = await tx
      .select()
      .from(harassmentReport)
      .where(and(eq(harassmentReport.id, id), eq(harassmentReport.tenantId, tenantId)));
    if (!r) return null;
    await logAccess(tx, tenantId, actor, "harassment_report", id, "lectura");
    return {
      ...r,
      narrativeEncrypted: undefined,
      noteEncrypted: undefined,
      narrative: decrypt(r.narrativeEncrypted, aadHar(tenantId)),
      note: r.noteEncrypted ? decrypt(r.noteEncrypted, aadHar(tenantId)) : null,
    };
  });
}

export async function updateHarassmentReport(
  tenantId: string,
  actor: Actor,
  id: string,
  status: "in_review" | "referred" | "closed",
  note: string,
) {
  if (note.trim().length < 3) throw new ConvivenciaError("Registra una nota del paso");
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, actor.userId), async (tx) => {
    const r = await tx
      .update(harassmentReport)
      .set({
        status,
        noteEncrypted: encrypt(note.trim(), aadHar(tenantId)),
        closedAt: status === "closed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(and(eq(harassmentReport.id, id), eq(harassmentReport.tenantId, tenantId)))
      .returning({ id: harassmentReport.id });
    if (!r.length) throw new ConvivenciaError("Reporte no encontrado");
    await logAccess(tx, tenantId, actor, "harassment_report", id, `estado:${status}`);
  });
}
