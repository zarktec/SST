import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { schema, withTenant } from "@/core/db";
import { assertWritable } from "@/core/plans/limits";
import { getActiveItems, getParameter } from "@/modules/platform/catalogs/service";
import {
  byPriority,
  controlWarnings,
  hazardRowSchema,
  reviewDue,
  valuate,
  type HazardRowInput,
  type Scale,
  type Valuation,
} from "./rules";

const { hazardMatrix, hazardRow } = schema;
export type Matrix = typeof hazardMatrix.$inferSelect;
export type Row = typeof hazardRow.$inferSelect;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });

export class HazardError extends Error {}

export async function loadScales() {
  const a = await getActiveItems<Scale>("gtc45_scales");
  if (!a) throw new HazardError("Las escalas de valoración GTC 45 aún no están cargadas");
  return { versionId: a.version.id, scales: a.items as unknown as Scale[] };
}

export async function listMatrices(tenantId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(hazardMatrix)
      .where(eq(hazardMatrix.tenantId, tenantId))
      .orderBy(desc(hazardMatrix.version)),
  );
}

/** Crea un borrador: vacío la primera vez, o copia de la última versión aprobada (con el motivo de la actualización). */
export async function createDraft(
  tenantId: string,
  userId: string,
  reason: "initial" | "annual" | "serious_accident" | "change" = "initial",
) {
  await assertWritable(tenantId);
  const { versionId } = await loadScales();
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const all = await tx
      .select()
      .from(hazardMatrix)
      .where(eq(hazardMatrix.tenantId, tenantId))
      .orderBy(desc(hazardMatrix.version));
    if (all.some((m) => m.status === "draft")) throw new HazardError("Ya hay un borrador en curso");
    const base = all.find((m) => m.status === "approved");
    const [m] = await tx
      .insert(hazardMatrix)
      .values({
        tenantId,
        version: (all[0]?.version ?? 0) + 1,
        reason: base ? (reason === "initial" ? "annual" : reason) : "initial",
        scalesVersionId: versionId,
        participation: base?.participation ?? null,
        createdBy: userId,
      })
      .returning();
    if (base) {
      const rows = await tx.select().from(hazardRow).where(eq(hazardRow.matrixId, base.id));
      if (rows.length)
        await tx.insert(hazardRow).values(
          rows.map((r) => ({
            ...r,
            id: undefined, // se genera uno nuevo para la copia
            createdAt: undefined,
            updatedAt: undefined,
            matrixId: m.id,
          })),
        );
    }
    return m.id;
  });
}

async function draftOf(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  tenantId: string,
  matrixId: string,
) {
  const [m] = await tx
    .select()
    .from(hazardMatrix)
    .where(and(eq(hazardMatrix.id, matrixId), eq(hazardMatrix.tenantId, tenantId)));
  if (!m) throw new HazardError("Matriz no encontrada");
  if (m.status !== "draft")
    throw new HazardError("Solo se edita un borrador; crea una versión nueva");
  return m;
}

function valuesFor(d: ReturnType<typeof hazardRowSchema.parse>, scales: Scale[]) {
  const v = valuate(d, scales);
  return {
    ...d,
    np: v.valued ? v.np : null,
    nr: v.valued ? v.nr : null,
    probabilityLevel: v.valued ? v.probabilityLevel : null,
    riskLevel: v.valued ? v.riskLevel : null,
    acceptability: v.valued ? v.acceptability : null,
    updatedAt: new Date(),
  };
}

export async function saveRow(
  tenantId: string,
  userId: string,
  matrixId: string,
  input: HazardRowInput,
  rowId?: string,
) {
  const d = hazardRowSchema.parse(input);
  await assertWritable(tenantId);
  const { scales } = await loadScales();
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    await draftOf(tx, tenantId, matrixId);
    if (d.workCenterId) {
      const [c] = await tx
        .select({ id: schema.workCenter.id })
        .from(schema.workCenter)
        .where(
          and(eq(schema.workCenter.id, d.workCenterId), eq(schema.workCenter.tenantId, tenantId)),
        );
      if (!c) throw new HazardError("Sede no encontrada");
    }
    const values = valuesFor(d, scales);
    if (rowId) {
      const r = await tx
        .update(hazardRow)
        .set(values)
        .where(
          and(
            eq(hazardRow.id, rowId),
            eq(hazardRow.matrixId, matrixId),
            eq(hazardRow.tenantId, tenantId),
          ),
        )
        .returning({ id: hazardRow.id });
      if (!r.length) throw new HazardError("Fila no encontrada");
      return rowId;
    }
    const [r] = await tx
      .insert(hazardRow)
      .values({ tenantId, matrixId, ...values })
      .returning({ id: hazardRow.id });
    return r.id;
  });
}

export async function deleteRow(tenantId: string, userId: string, matrixId: string, rowId: string) {
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    await draftOf(tx, tenantId, matrixId);
    await tx
      .delete(hazardRow)
      .where(
        and(
          eq(hazardRow.id, rowId),
          eq(hazardRow.matrixId, matrixId),
          eq(hazardRow.tenantId, tenantId),
        ),
      );
  });
}

export async function saveParticipation(
  tenantId: string,
  userId: string,
  matrixId: string,
  text: string,
) {
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    await draftOf(tx, tenantId, matrixId);
    await tx
      .update(hazardMatrix)
      .set({ participation: text.trim() || null, updatedAt: new Date() })
      .where(eq(hazardMatrix.id, matrixId));
  });
}

/** Aprueba el borrador: la versión anterior pasa a "superseded". Exige filas, valoración completa y participación registrada. */
export async function approveMatrix(tenantId: string, userId: string, matrixId: string) {
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const m = await draftOf(tx, tenantId, matrixId);
    const rows = await tx.select().from(hazardRow).where(eq(hazardRow.matrixId, matrixId));
    if (!rows.length) throw new HazardError("La matriz no tiene peligros registrados");
    const unvalued = rows.filter((r) => r.nr === null).length;
    if (unvalued)
      throw new HazardError(
        `${unvalued} peligros sin valoración (revisa los niveles de deficiencia)`,
      );
    if (!m.participation?.trim())
      throw new HazardError(
        "Registra cómo participaron los trabajadores en la identificación de peligros",
      );
    await tx
      .update(hazardMatrix)
      .set({ status: "superseded", updatedAt: new Date() })
      .where(and(eq(hazardMatrix.tenantId, tenantId), eq(hazardMatrix.status, "approved")));
    await tx
      .update(hazardMatrix)
      .set({
        status: "approved",
        approvedBy: userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(hazardMatrix.id, matrixId));
  });
}

/** Valoración ya guardada en la fila (sin recalcular con las escalas actuales). */
function storedValuation(r: Row): Valuation {
  if (r.nr === null || r.np === null) return { valued: false, reason: "Sin valoración" };
  return {
    valued: true,
    np: r.np,
    nr: r.nr,
    probabilityLevel: r.probabilityLevel ?? "",
    riskLevel: r.riskLevel ?? "",
    acceptability: r.acceptability ?? "",
  };
}

export async function getMatrix(tenantId: string, matrixId: string) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const [m] = await tx
      .select()
      .from(hazardMatrix)
      .where(and(eq(hazardMatrix.id, matrixId), eq(hazardMatrix.tenantId, tenantId)));
    if (!m) return null;
    const rows = await tx
      .select()
      .from(hazardRow)
      .where(eq(hazardRow.matrixId, matrixId))
      .orderBy(asc(hazardRow.process), asc(hazardRow.activity));
    const sorted = byPriority(rows);
    const count = (k: string) => rows.filter((r) => r.riskLevel === k).length;
    return {
      matrix: m,
      rows: sorted,
      summary: {
        total: rows.length,
        I: count("I"),
        II: count("II"),
        III: count("III"),
        IV: count("IV"),
        unvalued: rows.filter((r) => r.nr === null).length,
      },
      warnings: new Map(rows.map((r) => [r.id, controlWarnings(storedValuation(r), r)] as const)),
    };
  });
}

/** ¿Hay que revisar la matriz? (sin matriz aprobada, o cumplido el plazo mínimo anual parametrizable). */
export async function reviewStatus(tenantId: string, now = new Date()) {
  const months = await getParameter("matriz_peligros.actualizacion_meses", 12);
  const all = await listMatrices(tenantId);
  const approved = all.find((m) => m.status === "approved");
  const hasDraft = all.some((m) => m.status === "draft");
  return {
    due: reviewDue(approved?.approvedAt ?? null, now, months),
    hasApproved: Boolean(approved),
    hasDraft,
    approvedAt: approved?.approvedAt ?? null,
  };
}
