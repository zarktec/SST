import "server-only";
import { and, asc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { schema, withTenant, type Tx } from "@/core/db";
import { blindIndex, decrypt, encrypt } from "@/core/crypto/envelope";
import { assertCanAdd, assertWritable } from "@/core/plans/limits";
import { parseCsv } from "@/modules/platform/catalogs/csv";
import { getParameter } from "@/modules/platform/catalogs/service";
import {
  isActive,
  parseWorkerRows,
  previousPeriod,
  ssState,
  workerSchema,
  type ImportReport,
  type WorkerData,
  type WorkerInput,
} from "./rules";

const { worker, contractorSsCheck, workCenter } = schema;
export type Worker = typeof worker.$inferSelect;
const today = () => new Date().toISOString().slice(0, 10);
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });
const aad = (tenantId: string) => `worker:${tenantId}:id`;
const bidx = (tenantId: string, idNumber: string) => blindIndex(idNumber, `worker:${tenantId}`);

export class WorkerError extends Error {}

function rowValues(tenantId: string, d: WorkerData) {
  return {
    kind: d.kind,
    idType: d.idType,
    idEncrypted: encrypt(d.idNumber, aad(tenantId)),
    idBlind: bidx(tenantId, d.idNumber),
    idLast4: d.idNumber.slice(-4),
    fullName: d.fullName,
    email: d.email,
    phone: d.phone,
    position: d.position,
    area: d.area,
    workCenterId: d.workCenterId,
    contractType: d.contractType,
    startDate: d.startDate,
    endDate: d.endDate,
    eps: d.eps,
    afp: d.afp,
    arl: d.arl,
    arlRiskClass: d.arlRiskClass,
    ccf: d.ccf,
    contractorCompany: d.contractorCompany,
  };
}

async function assertCenterOwned(tx: Tx, tenantId: string, id: string | null) {
  if (!id) return;
  const [c] = await tx
    .select({ id: workCenter.id })
    .from(workCenter)
    .where(
      and(eq(workCenter.id, id), eq(workCenter.tenantId, tenantId), isNull(workCenter.deletedAt)),
    );
  if (!c) throw new WorkerError("Sede no encontrada");
}

/** Cuenta contra el límite del plan solo si no es contratista y no está retirado. */
const countsAgainstLimit = (d: Pick<WorkerData, "kind" | "endDate">) =>
  d.kind !== "contractor" && isActive({ endDate: d.endDate }, today());

export async function createWorker(tenantId: string, userId: string, input: WorkerInput) {
  const d = workerSchema.parse(input);
  await assertWritable(tenantId);
  if (countsAgainstLimit(d)) await assertCanAdd(tenantId, "workers");
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    await assertCenterOwned(tx, tenantId, d.workCenterId);
    const dup = await tx
      .select({ id: worker.id })
      .from(worker)
      .where(
        and(
          eq(worker.tenantId, tenantId),
          eq(worker.idBlind, bidx(tenantId, d.idNumber)),
          isNull(worker.deletedAt),
        ),
      );
    if (dup.length) throw new WorkerError("Ya existe una persona con ese documento");
    const [w] = await tx
      .insert(worker)
      .values({ tenantId, ...rowValues(tenantId, d) })
      .returning({ id: worker.id });
    return w.id;
  });
}

export async function updateWorker(
  tenantId: string,
  userId: string,
  id: string,
  input: WorkerInput,
) {
  const d = workerSchema.parse(input);
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    await assertCenterOwned(tx, tenantId, d.workCenterId);
    const [cur] = await tx
      .select()
      .from(worker)
      .where(and(eq(worker.id, id), eq(worker.tenantId, tenantId), isNull(worker.deletedAt)));
    if (!cur) throw new WorkerError("Persona no encontrada");
    const blind = bidx(tenantId, d.idNumber);
    if (blind !== cur.idBlind) {
      const dup = await tx
        .select({ id: worker.id })
        .from(worker)
        .where(
          and(eq(worker.tenantId, tenantId), eq(worker.idBlind, blind), isNull(worker.deletedAt)),
        );
      if (dup.length) throw new WorkerError("Ya existe una persona con ese documento");
    }
    await tx
      .update(worker)
      .set({ ...rowValues(tenantId, d), updatedAt: new Date() })
      .where(eq(worker.id, id));
  });
}

/** Retiro: registra la fecha de salida; el registro se conserva (registro ♻, mínimo 20 años). */
export async function retireWorker(tenantId: string, userId: string, id: string, endDate: string) {
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [cur] = await tx
      .select()
      .from(worker)
      .where(and(eq(worker.id, id), eq(worker.tenantId, tenantId)));
    if (!cur) throw new WorkerError("Persona no encontrada");
    if (endDate < cur.startDate)
      throw new WorkerError("El retiro no puede ser anterior al ingreso");
    await tx.update(worker).set({ endDate, updatedAt: new Date() }).where(eq(worker.id, id));
  });
}

export type WorkerFilters = {
  q?: string;
  kind?: string;
  centerId?: string;
  status?: "active" | "retired";
  /** Paginación (por defecto, hasta 500 filas). */
  limit?: number;
  offset?: number;
};

function workerConds(tenantId: string, f: WorkerFilters): SQL[] {
  const conds: SQL[] = [eq(worker.tenantId, tenantId), isNull(worker.deletedAt)];
  if (f.kind) conds.push(eq(worker.kind, f.kind));
  if (f.centerId) conds.push(eq(worker.workCenterId, f.centerId));
  if (f.status === "active")
    conds.push(or(isNull(worker.endDate), sql`${worker.endDate} >= current_date`)!);
  if (f.status === "retired") conds.push(sql`${worker.endDate} < current_date`);
  if (f.q) {
    const like = `%${f.q.replace(/[%_]/g, "")}%`;
    // La búsqueda por documento usa el blind index (igualdad exacta); el resto es texto.
    conds.push(
      or(
        ilike(worker.fullName, like),
        ilike(worker.position, like),
        eq(worker.idBlind, bidx(tenantId, f.q.trim())),
      )!,
    );
  }
  return conds;
}

export async function countWorkers(tenantId: string, f: WorkerFilters = {}) {
  const [r] = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(worker)
      .where(and(...workerConds(tenantId, f))),
  );
  return r.n;
}

export async function listWorkers(tenantId: string, f: WorkerFilters = {}) {
  const conds = workerConds(tenantId, f);
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({
        id: worker.id,
        kind: worker.kind,
        fullName: worker.fullName,
        idLast4: worker.idLast4,
        position: worker.position,
        area: worker.area,
        workCenterId: worker.workCenterId,
        startDate: worker.startDate,
        endDate: worker.endDate,
        contractorCompany: worker.contractorCompany,
      })
      .from(worker)
      .where(and(...conds))
      .orderBy(asc(worker.fullName), asc(worker.id))
      .limit(f.limit ?? 500)
      .offset(f.offset ?? 0),
  );
}

/** Ficha completa con el documento descifrado (solo para quien tiene permiso de ver trabajadores). */
export async function getWorker(tenantId: string, id: string) {
  const w = await withTenant(ctxOf(tenantId), async (tx) => {
    const [row] = await tx
      .select()
      .from(worker)
      .where(and(eq(worker.id, id), eq(worker.tenantId, tenantId), isNull(worker.deletedAt)));
    return row;
  });
  if (!w) return null;
  const { idEncrypted, idBlind: _b, ...rest } = w;
  void _b;
  return { ...rest, idNumber: decrypt(idEncrypted, aad(tenantId)) };
}

export function previewImport(csv: string, centers: { id: string; name: string }[]): ImportReport {
  const byName = new Map(
    centers.map((c) => [c.name.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase(), c.id]),
  );
  try {
    return parseWorkerRows(parseCsv(csv), byName);
  } catch (e) {
    return {
      valid: [],
      errors: [{ row: 1, message: e instanceof Error ? e.message : "Archivo inválido" }],
    };
  }
}

/**
 * Carga masiva: importa las filas válidas y reporta las erróneas. Los documentos ya registrados se omiten con aviso.
 * El límite del plan se verifica sobre el total de nuevos trabajadores (no contratistas) antes de insertar.
 */
export async function importWorkers(tenantId: string, userId: string, csv: string) {
  await assertWritable(tenantId);
  const centers = await listCentersLite(tenantId);
  const report = previewImport(csv, centers);
  const inserted: number[] = [];
  const skipped: { row: number; message: string }[] = [];
  const existing = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ b: worker.idBlind })
      .from(worker)
      .where(and(eq(worker.tenantId, tenantId), isNull(worker.deletedAt))),
  );
  const have = new Set(existing.map((e) => e.b));
  const toInsert = report.valid.filter((v) => {
    if (have.has(bidx(tenantId, v.data.idNumber))) {
      skipped.push({ row: v.row, message: "Ya existe una persona con ese documento (omitida)" });
      return false;
    }
    return true;
  });
  const adds = toInsert.filter((v) => countsAgainstLimit(v.data)).length;
  if (adds) await assertCanAdd(tenantId, "workers", adds);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    for (const v of toInsert) {
      await tx.insert(worker).values({ tenantId, ...rowValues(tenantId, v.data) });
      inserted.push(v.row);
    }
  });
  return { imported: inserted.length, skipped, errors: report.errors };
}

async function listCentersLite(tenantId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ id: workCenter.id, name: workCenter.name })
      .from(workCenter)
      .where(and(eq(workCenter.tenantId, tenantId), isNull(workCenter.deletedAt))),
  );
}
export { listCentersLite as listCenters };

/** Registra (o corrige) la verificación del pago de seguridad social de un contratista para un periodo AAAA-MM. */
export async function recordSsCheck(
  tenantId: string,
  userId: string,
  workerId: string,
  input: { period: string; paid: boolean; note?: string },
) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period))
    throw new WorkerError("Periodo inválido (AAAA-MM)");
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [w] = await tx
      .select()
      .from(worker)
      .where(and(eq(worker.id, workerId), eq(worker.tenantId, tenantId)));
    if (!w || w.kind !== "contractor")
      throw new WorkerError("Solo se verifica la seguridad social de contratistas");
    const values = {
      paid: input.paid,
      note: input.note?.trim() || null,
      verifiedBy: userId,
      verifiedAt: new Date(),
    };
    await tx
      .insert(contractorSsCheck)
      .values({ tenantId, workerId, period: input.period, ...values })
      .onConflictDoUpdate({
        target: [contractorSsCheck.workerId, contractorSsCheck.period],
        set: values,
      });
  });
}

export async function contractorStatuses(tenantId: string) {
  const deadline = await getParameter("contratistas.ss_verificacion_dia", 10);
  return withTenant(ctxOf(tenantId), async (tx) => {
    const contractors = await tx
      .select()
      .from(worker)
      .where(
        and(eq(worker.tenantId, tenantId), eq(worker.kind, "contractor"), isNull(worker.deletedAt)),
      );
    const checks = await tx
      .select()
      .from(contractorSsCheck)
      .where(eq(contractorSsCheck.tenantId, tenantId));
    const t = today();
    return contractors
      .filter((c) => isActive(c, t))
      .map((c) => ({
        id: c.id,
        fullName: c.fullName,
        contractorCompany: c.contractorCompany,
        duePeriod: previousPeriod(t),
        state: ssState(
          checks.filter((k) => k.workerId === c.id),
          t,
          deadline,
        ),
      }));
  });
}

export async function workerSsChecks(tenantId: string, workerId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(contractorSsCheck)
      .where(
        and(eq(contractorSsCheck.tenantId, tenantId), eq(contractorSsCheck.workerId, workerId)),
      )
      .orderBy(sql`period desc`),
  );
}

/** Persona activa por número de documento (blind index): para flujos públicos como la asistencia por QR. */
export async function findActiveWorkerByDocument(tenantId: string, idNumber: string) {
  const blind = bidx(tenantId, idNumber.trim());
  return withTenant(ctxOf(tenantId), async (tx) => {
    const [w] = await tx
      .select({
        id: worker.id,
        fullName: worker.fullName,
        endDate: worker.endDate,
        startDate: worker.startDate,
      })
      .from(worker)
      .where(
        and(eq(worker.tenantId, tenantId), eq(worker.idBlind, blind), isNull(worker.deletedAt)),
      );
    return w && isActive(w, today()) ? w : null;
  });
}
