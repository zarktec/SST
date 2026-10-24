import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { schema, withTenant } from "@/core/db";
import { assertWritable } from "@/core/plans/limits";
import { todayYmd } from "@/lib/dates";
import { getParameter } from "@/modules/platform/catalogs/service";
import { compatibilityConflicts, sdsState, substanceIssues, substanceSchema } from "./rules";

const { chemicalSubstance } = schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });
export class ChemicalError extends Error {}

export async function saveSubstance(tenantId: string, userId: string, raw: unknown, id?: string) {
  const d = substanceSchema.parse(raw);
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    if (id) {
      const r = await tx
        .update(chemicalSubstance)
        .set({ ...d, updatedAt: new Date() })
        .where(and(eq(chemicalSubstance.id, id), eq(chemicalSubstance.tenantId, tenantId)))
        .returning({ id: chemicalSubstance.id });
      if (!r.length) throw new ChemicalError("Sustancia no encontrada");
      return id;
    }
    const [s] = await tx
      .insert(chemicalSubstance)
      .values({ tenantId, ...d })
      .returning({ id: chemicalSubstance.id });
    return s.id;
  });
}

/** Actualiza solo la revisión de la FDS y/o la verificación del etiquetado. */
export async function updateCompliance(
  tenantId: string,
  userId: string,
  id: string,
  patch: { sdsRevisedOn?: string; labelCheckedOn?: string },
) {
  for (const v of [patch.sdsRevisedOn, patch.labelCheckedOn])
    if (v && (!/^\d{4}-\d{2}-\d{2}$/.test(v) || v > todayYmd()))
      throw new ChemicalError("Fecha inválida");
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const r = await tx
      .update(chemicalSubstance)
      .set({
        ...(patch.sdsRevisedOn ? { sdsRevisedOn: patch.sdsRevisedOn } : {}),
        ...(patch.labelCheckedOn ? { labelCheckedOn: patch.labelCheckedOn } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(chemicalSubstance.id, id), eq(chemicalSubstance.tenantId, tenantId)))
      .returning({ id: chemicalSubstance.id });
    if (!r.length) throw new ChemicalError("Sustancia no encontrada");
  });
}

export async function retireSubstance(tenantId: string, userId: string, id: string) {
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .update(chemicalSubstance)
      .set({ active: false, updatedAt: new Date() })
      .where(and(eq(chemicalSubstance.id, id), eq(chemicalSubstance.tenantId, tenantId))),
  );
}

export async function listSubstances(tenantId: string) {
  const years = await getParameter("quimicos.revision_fds_anios", 5);
  const today = todayYmd();
  const rows = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(chemicalSubstance)
      .where(and(eq(chemicalSubstance.tenantId, tenantId), eq(chemicalSubstance.active, true)))
      .orderBy(asc(chemicalSubstance.location), asc(chemicalSubstance.name)),
  );
  return rows.map((s) => ({
    ...s,
    sds: sdsState(s.sdsRevisedOn, today, years),
    issues: substanceIssues(s, today, years),
  }));
}

export async function chemicalSummary(tenantId: string) {
  const subs = await listSubstances(tenantId);
  return {
    total: subs.length,
    withoutSds: subs.filter((s) => s.sds === "sin_fds").length,
    sdsToReview: subs.filter((s) => s.sds === "por_revisar").length,
    unlabeled: subs.filter((s) => !s.labelCheckedOn).length,
    conflicts: compatibilityConflicts(subs),
  };
}
