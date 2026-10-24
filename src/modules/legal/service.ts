import "server-only";
import { and, eq } from "drizzle-orm";
import { schema, withTenant } from "@/core/db";
import { assertWritable } from "@/core/plans/limits";
import { getActiveItems } from "@/modules/platform/catalogs/service";
import { entrySchema, summarize, type EntryInput, type MatrixRow } from "./rules";
import { todayYmd } from "@/lib/dates";

const { legalMatrixEntry } = schema;
export type Entry = typeof legalMatrixEntry.$inferSelect;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });

export class LegalError extends Error {}

type Norm = {
  type: string;
  number: string;
  year: number;
  title: string;
  issuer: string;
  appliesTo: string[];
  url: string;
};
type Req = {
  normCode: string;
  article: string;
  requirement: string;
  appliesTo: string[];
  periodicity: string;
};

export type MatrixLine = {
  kind: "norm" | "requirement";
  code: string;
  normCode: string;
  title: string;
  detail: string;
  appliesTo: string[];
  periodicity: string;
  url: string;
  entry: Entry | null;
};

/** Matriz de la empresa: base vigente del SUPER ADMIN (normas y sus requisitos) cruzada con lo que la empresa ya evaluó. */
export async function getMatrix(tenantId: string) {
  const [norms, reqs, entries] = await Promise.all([
    getActiveItems<Norm>("legal_norms"),
    getActiveItems<Req>("legal_requirements"),
    withTenant(ctxOf(tenantId), (tx) =>
      tx.select().from(legalMatrixEntry).where(eq(legalMatrixEntry.tenantId, tenantId)),
    ),
  ]);
  const byKey = new Map(entries.map((e) => [`${e.kind}:${e.code}`, e]));
  const lines: MatrixLine[] = [];
  for (const n of norms?.items ?? []) {
    lines.push({
      kind: "norm",
      code: n.code,
      normCode: n.code,
      title: `${n.type} ${n.number} de ${n.year}`,
      detail: n.title,
      appliesTo: n.appliesTo,
      periodicity: "",
      url: n.url,
      entry: byKey.get(`norm:${n.code}`) ?? null,
    });
    for (const r of (reqs?.items ?? []).filter((r) => r.normCode === n.code))
      lines.push({
        kind: "requirement",
        code: r.code,
        normCode: n.code,
        title: `Art. ${r.article}`,
        detail: r.requirement,
        appliesTo: r.appliesTo,
        periodicity: r.periodicity,
        url: "",
        entry: byKey.get(`requirement:${r.code}`) ?? null,
      });
  }
  const rows: MatrixRow[] = lines.map((l) => ({ kind: l.kind, code: l.code, entry: l.entry }));
  return {
    lines,
    version: { norms: norms?.version.version ?? null, requirements: reqs?.version.version ?? null },
    summary: summarize(rows, todayYmd()),
  };
}

/** Normas y requisitos de la base que la empresa aún no ha evaluado (incluye los publicados recientemente). */
export async function unevaluatedCount(tenantId: string): Promise<number> {
  return (await getMatrix(tenantId)).summary.unevaluated;
}

export async function saveEntry(tenantId: string, userId: string, input: EntryInput) {
  const e = entrySchema.parse(input);
  await assertWritable(tenantId);
  const active = await getActiveItems<Record<string, unknown>>(
    e.kind === "norm" ? "legal_norms" : "legal_requirements",
  );
  if (!active?.items.some((i) => i.code === e.code))
    throw new LegalError("Ese elemento no está en la matriz base vigente");
  const values = {
    applies: e.applies,
    justification: e.justification,
    compliance: e.compliance,
    evidence: e.evidence,
    responsibleName: e.responsibleName,
    nextReviewDate: e.nextReviewDate,
    notes: e.notes,
    reviewedBy: userId,
    reviewedAt: new Date(),
    updatedAt: new Date(),
  };
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .insert(legalMatrixEntry)
      .values({ tenantId, kind: e.kind, code: e.code, ...values })
      .onConflictDoUpdate({
        target: [legalMatrixEntry.tenantId, legalMatrixEntry.kind, legalMatrixEntry.code],
        set: values,
      }),
  );
}

export async function entryFor(tenantId: string, kind: string, code: string) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const [e] = await tx
      .select()
      .from(legalMatrixEntry)
      .where(
        and(
          eq(legalMatrixEntry.tenantId, tenantId),
          eq(legalMatrixEntry.kind, kind),
          eq(legalMatrixEntry.code, code),
        ),
      );
    return e ?? null;
  });
}
