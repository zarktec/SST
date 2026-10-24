import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { schema, withTenant } from "@/core/db";
import { bogotaDate } from "@/core/calendar/business-days";
import { assertWritable } from "@/core/plans/limits";
import { isValidSignature, hashEvidence } from "@/core/signature";
import { todayYmd } from "@/lib/dates";
import { expiryState } from "@/modules/emergencies/rules";
import { getParameter } from "@/modules/platform/catalogs/service";
import {
  DEFAULT_TYPES,
  authorizeBlockers,
  certificateExpiry,
  certificateSchema,
  equipmentSchema,
  parseChecklist,
  permitState,
  requestSchema,
  typeSchema,
} from "./rules";
import type { PermitChecklistItem } from "@/core/db/schema/high-risk";

const { permitType, workPermit, heightCertificate, heightEquipment, worker } = schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });
export class HighRiskError extends Error {}

// ---------- Tipos de permiso ----------
export async function ensureDefaultTypes(tenantId: string, userId: string) {
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const have = await tx
      .select({ kind: permitType.kind })
      .from(permitType)
      .where(eq(permitType.tenantId, tenantId));
    const kinds = new Set(have.map((h) => h.kind));
    const missing = DEFAULT_TYPES.filter((d) => !kinds.has(d.kind));
    if (missing.length)
      await tx.insert(permitType).values(
        missing.map((d) => ({
          tenantId,
          kind: d.kind,
          name: d.name,
          requiresCertificate: d.requiresCertificate,
          requiresRescuePlan: d.requiresRescuePlan,
          maxHours: d.maxHours,
          checklist: d.items.map(([text, required], i) => ({ id: `c${i + 1}`, text, required })),
        })),
      );
  });
}

export async function saveType(tenantId: string, userId: string, raw: unknown, id?: string) {
  const d = typeSchema.parse(raw);
  await assertWritable(tenantId);
  const values = {
    kind: d.kind,
    name: d.name,
    maxHours: d.maxHours,
    requiresCertificate: d.requiresCertificate,
    requiresRescuePlan: d.requiresRescuePlan,
    checklist: parseChecklist(d.itemsText),
  };
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    if (id) {
      const r = await tx
        .update(permitType)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(permitType.id, id), eq(permitType.tenantId, tenantId)))
        .returning({ id: permitType.id });
      if (!r.length) throw new HighRiskError("Tipo de permiso no encontrado");
      return id;
    }
    const [t] = await tx
      .insert(permitType)
      .values({ tenantId, ...values })
      .returning({ id: permitType.id });
    return t.id;
  });
}

export async function listTypes(tenantId: string, opts: { activeOnly?: boolean } = {}) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(permitType)
      .where(
        opts.activeOnly
          ? and(eq(permitType.tenantId, tenantId), eq(permitType.active, true))
          : eq(permitType.tenantId, tenantId),
      )
      .orderBy(asc(permitType.name)),
  );
}

export async function setTypeActive(tenantId: string, id: string, active: boolean) {
  await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .update(permitType)
      .set({ active, updatedAt: new Date() })
      .where(and(eq(permitType.id, id), eq(permitType.tenantId, tenantId))),
  );
}

// ---------- Certificados y equipos de alturas ----------
export async function addCertificate(tenantId: string, userId: string, raw: unknown) {
  const d = certificateSchema.parse(raw);
  await assertWritable(tenantId);
  const months = await getParameter("alturas.vigencia_certificado_meses", 12);
  const expiresOn = d.expiresOn ?? certificateExpiry(d.issuedOn, months);
  if (expiresOn <= d.issuedOn)
    throw new HighRiskError("El vencimiento debe ser posterior a la expedición");
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [w] = await tx
      .select({ id: worker.id })
      .from(worker)
      .where(
        and(eq(worker.id, d.workerId), eq(worker.tenantId, tenantId), isNull(worker.deletedAt)),
      );
    if (!w) throw new HighRiskError("Persona no encontrada");
    const [c] = await tx
      .insert(heightCertificate)
      .values({
        tenantId,
        workerId: d.workerId,
        level: d.level,
        issuer: d.issuer,
        issuedOn: d.issuedOn,
        expiresOn,
      })
      .returning({ id: heightCertificate.id });
    return c.id;
  });
}

export async function listCertificates(tenantId: string) {
  const warn = await getParameter("alturas.alerta_vencimiento_dias", 30);
  const today = todayYmd();
  const rows = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ c: heightCertificate, name: worker.fullName })
      .from(heightCertificate)
      .innerJoin(worker, eq(worker.id, heightCertificate.workerId))
      .where(eq(heightCertificate.tenantId, tenantId))
      .orderBy(desc(heightCertificate.expiresOn)),
  );
  // Por persona y nivel solo cuenta el certificado más reciente: los anteriores quedan como histórico.
  const seen = new Set<string>();
  return rows.map(({ c, name }) => {
    const key = `${c.workerId}:${c.level}`;
    const current = !seen.has(key);
    seen.add(key);
    return { ...c, name, current, state: expiryState(c.expiresOn, today, warn) };
  });
}

export async function addEquipment(tenantId: string, userId: string, raw: unknown) {
  const d = equipmentSchema.parse(raw);
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [e] = await tx
      .insert(heightEquipment)
      .values({ tenantId, ...d })
      .returning({ id: heightEquipment.id });
    return e.id;
  });
}
export async function updateEquipment(
  tenantId: string,
  userId: string,
  id: string,
  patch: { certifiedUntil?: string; lastInspectedOn?: string; active?: boolean },
) {
  for (const v of [patch.certifiedUntil, patch.lastInspectedOn])
    if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new HighRiskError("Fecha inválida");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const r = await tx
      .update(heightEquipment)
      .set({
        ...(patch.certifiedUntil ? { certifiedUntil: patch.certifiedUntil } : {}),
        ...(patch.lastInspectedOn ? { lastInspectedOn: patch.lastInspectedOn } : {}),
        ...(patch.active !== undefined ? { active: patch.active } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(heightEquipment.id, id), eq(heightEquipment.tenantId, tenantId)))
      .returning({ id: heightEquipment.id });
    if (!r.length) throw new HighRiskError("Equipo no encontrado");
  });
}
export async function listEquipment(tenantId: string) {
  const warn = await getParameter("alturas.alerta_vencimiento_dias", 30);
  const today = todayYmd();
  const rows = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(heightEquipment)
      .where(and(eq(heightEquipment.tenantId, tenantId), eq(heightEquipment.active, true)))
      .orderBy(asc(heightEquipment.code)),
  );
  return rows.map((e) => ({ ...e, state: expiryState(e.certifiedUntil, today, warn) }));
}

// ---------- Permisos ----------
type Evidence = { ip?: string | null; userAgent?: string | null };
const stamp = (parts: (string | null)[], signature: string, ev: Evidence, at: Date) =>
  hashEvidence([...parts, at.toISOString(), signature, ev.ip ?? null, ev.userAgent ?? null]);

export async function requestPermit(
  tenantId: string,
  userId: string,
  userName: string,
  raw: unknown,
  extra: { answers: Record<string, string>; workerIds: string[]; signature: string },
  ev: Evidence = {},
) {
  const d = requestSchema.parse(raw);
  await assertWritable(tenantId);
  if (!isValidSignature(extra.signature))
    throw new HighRiskError("Falta la firma del solicitante o no es válida");
  const validFrom = new Date(`${d.date}T${d.fromTime}:00-05:00`);
  const validUntil = new Date(`${d.date}T${d.toTime}:00-05:00`);
  if (Number.isNaN(validFrom.getTime()) || Number.isNaN(validUntil.getTime()))
    throw new HighRiskError("Fecha u hora inválida");
  if (validUntil <= validFrom)
    throw new HighRiskError("La hora final debe ser posterior a la inicial");
  if (validUntil < new Date()) throw new HighRiskError("El permiso no puede estar en el pasado");
  const at = new Date();
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [t] = await tx
      .select()
      .from(permitType)
      .where(
        and(
          eq(permitType.id, d.typeId),
          eq(permitType.tenantId, tenantId),
          eq(permitType.active, true),
        ),
      );
    if (!t) throw new HighRiskError("Tipo de permiso no encontrado");
    const ids = [...new Set(extra.workerIds)];
    const people = ids.length
      ? await tx
          .select({ id: worker.id, name: worker.fullName })
          .from(worker)
          .where(
            and(eq(worker.tenantId, tenantId), isNull(worker.deletedAt), inArray(worker.id, ids)),
          )
      : [];
    if (people.length !== ids.length) throw new HighRiskError("Alguna persona no fue encontrada");
    const checklist: PermitChecklistItem[] = t.checklist.map((i) => {
      const a = extra.answers[i.id];
      return { ...i, answer: a === "ok" || a === "fail" || a === "na" ? a : undefined };
    });
    if (d.coordinatorWorkerId) {
      const [c] = await tx
        .select({ id: worker.id })
        .from(worker)
        .where(
          and(
            eq(worker.id, d.coordinatorWorkerId),
            eq(worker.tenantId, tenantId),
            isNull(worker.deletedAt),
          ),
        );
      if (!c) throw new HighRiskError("Coordinador no encontrado");
    }
    const [p] = await tx
      .insert(workPermit)
      .values({
        tenantId,
        typeId: t.id,
        typeName: t.name,
        requiresCertificate: t.requiresCertificate,
        place: d.place,
        workCenterId: d.workCenterId,
        description: d.description,
        validFrom,
        validUntil,
        checklist,
        workers: people.map((x) => ({ workerId: x.id, name: x.name })),
        coordinatorWorkerId: d.coordinatorWorkerId,
        rescuePlan: d.rescuePlan,
        requestedBy: userId,
        requestedName: userName,
        requesterSignature: extra.signature,
        requesterEvidence: stamp([userId, d.typeId, d.description], extra.signature, ev, at),
        requestedAt: at,
      })
      .returning({ id: workPermit.id });
    return p.id;
  });
}

async function loadPermit(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  tenantId: string,
  id: string,
) {
  const [p] = await tx
    .select()
    .from(workPermit)
    .where(and(eq(workPermit.id, id), eq(workPermit.tenantId, tenantId)));
  if (!p) throw new HighRiskError("Permiso no encontrado");
  return p;
}

/** Bloqueos actuales para autorizar un permiso (se usa en la pantalla y al autorizar). */
export async function permitBlockers(tenantId: string, id: string) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const p = await loadPermit(tx, tenantId, id);
    const [t] = await tx.select().from(permitType).where(eq(permitType.id, p.typeId));
    const certs = p.requiresCertificate
      ? await tx.select().from(heightCertificate).where(eq(heightCertificate.tenantId, tenantId))
      : [];
    return authorizeBlockers({
      requiresCertificate: p.requiresCertificate,
      requiresRescuePlan: t?.requiresRescuePlan ?? false,
      maxHours: t?.maxHours ?? 8,
      checklist: p.checklist,
      rescuePlan: p.rescuePlan,
      validFrom: p.validFrom,
      validUntil: p.validUntil,
      workers: p.workers,
      coordinatorWorkerId: p.coordinatorWorkerId,
      certificates: certs,
      workDate: bogotaDate(p.validFrom),
    });
  });
}

/** Autoriza el permiso con la firma de quien autoriza. Debe ser una persona distinta del solicitante y no haber bloqueos. */
export async function authorizePermit(
  tenantId: string,
  userId: string,
  userName: string,
  id: string,
  signature: string,
  ev: Evidence = {},
) {
  await assertWritable(tenantId);
  if (!isValidSignature(signature))
    throw new HighRiskError("Falta la firma de quien autoriza o no es válida");
  const blockers = await permitBlockers(tenantId, id);
  if (blockers.length) throw new HighRiskError(blockers.join(". "));
  const at = new Date();
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const p = await loadPermit(tx, tenantId, id);
    if (p.status !== "requested") throw new HighRiskError("El permiso ya fue autorizado o cerrado");
    if (p.requestedBy === userId)
      throw new HighRiskError("Quien solicita el permiso no puede autorizarlo");
    if (p.validUntil < at) throw new HighRiskError("La vigencia del permiso ya terminó");
    await tx
      .update(workPermit)
      .set({
        status: "authorized",
        authorizedBy: userId,
        authorizedName: userName,
        authorizerSignature: signature,
        authorizerEvidence: stamp([userId, id, p.requesterEvidence], signature, ev, at),
        authorizedAt: at,
        updatedAt: at,
      })
      .where(eq(workPermit.id, id));
  });
}

export async function closePermit(tenantId: string, userId: string, id: string, note: string) {
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const p = await loadPermit(tx, tenantId, id);
    if (p.status !== "authorized")
      throw new HighRiskError("Solo se cierran los permisos autorizados");
    await tx
      .update(workPermit)
      .set({
        status: "closed",
        closedAt: new Date(),
        closedBy: userId,
        closeNote: note.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(workPermit.id, id));
  });
}

export async function cancelPermit(tenantId: string, userId: string, id: string, reason: string) {
  if (reason.trim().length < 5) throw new HighRiskError("Indica el motivo de la cancelación");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const p = await loadPermit(tx, tenantId, id);
    if (p.status === "closed" || p.status === "cancelled")
      throw new HighRiskError("El permiso ya está cerrado");
    await tx
      .update(workPermit)
      .set({ status: "cancelled", cancelReason: reason.trim(), updatedAt: new Date() })
      .where(eq(workPermit.id, id));
  });
}

export async function listPermits(tenantId: string) {
  const now = new Date();
  const rows = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(workPermit)
      .where(eq(workPermit.tenantId, tenantId))
      .orderBy(desc(workPermit.validFrom)),
  );
  return rows.map((p) => ({ ...p, state: permitState(p, now) }));
}

export async function highRiskSummary(tenantId: string) {
  const [permits, certs, equipment] = await Promise.all([
    listPermits(tenantId),
    listCertificates(tenantId),
    listEquipment(tenantId),
  ]);
  const cur = certs.filter((c) => c.current);
  return {
    toAuthorize: permits.filter((p) => p.state === "solicitado").length,
    toClose: permits.filter((p) => p.state === "vencido").length,
    certsExpired: cur.filter((c) => c.state === "vencido").length,
    certsExpiring: cur.filter((c) => c.state === "por_vencer").length,
    equipmentExpired: equipment.filter((e) => e.state === "vencido").length,
    equipmentExpiring: equipment.filter((e) => e.state === "por_vencer").length,
  };
}
