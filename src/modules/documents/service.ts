import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { schema, withTenant } from "@/core/db";
import { assertWritable } from "@/core/plans/limits";
import { hashEvidence, isValidSignature } from "@/core/signature";
import { todayYmd } from "@/lib/dates";
import { getActiveItems, getParameter } from "@/modules/platform/catalogs/service";
import {
  approveSchema,
  bodyHash,
  documentSchema,
  nextReview,
  renderTemplate,
  reviewState,
  versionSchema,
} from "./rules";

const { document, documentVersion, documentAck, tenant } = schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });
export class DocumentError extends Error {}

export async function createDocument(
  tenantId: string,
  userId: string,
  userName: string,
  raw: unknown,
) {
  const d = documentSchema.parse(raw);
  await assertWritable(tenantId);
  const defaultMonths = await getParameter("documentos.revision_meses", 12);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [dup] = await tx
      .select({ id: document.id })
      .from(document)
      .where(and(eq(document.tenantId, tenantId), eq(document.code, d.code)));
    if (dup) throw new DocumentError("Ya existe un documento con ese código");
    const [doc] = await tx
      .insert(document)
      .values({
        tenantId,
        code: d.code,
        title: d.title,
        kind: d.kind,
        ownerName: d.ownerName,
        reviewMonths: d.reviewMonths ?? defaultMonths,
      })
      .returning({ id: document.id });
    await tx.insert(documentVersion).values({
      tenantId,
      documentId: doc.id,
      version: 1,
      body: d.body,
      changeNote: "Versión inicial",
      createdBy: userId,
      createdByName: userName,
    });
    return doc.id;
  });
}

/** Edita el borrador abierto; si no hay borrador (la última versión está aprobada) abre la siguiente versión. */
export async function saveDraft(
  tenantId: string,
  userId: string,
  userName: string,
  documentId: string,
  raw: unknown,
) {
  const d = versionSchema.parse(raw);
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [doc] = await tx
      .select()
      .from(document)
      .where(and(eq(document.id, documentId), eq(document.tenantId, tenantId)));
    if (!doc) throw new DocumentError("Documento no encontrado");
    const [last] = await tx
      .select()
      .from(documentVersion)
      .where(eq(documentVersion.documentId, documentId))
      .orderBy(desc(documentVersion.version))
      .limit(1);
    if (last.status === "draft") {
      await tx
        .update(documentVersion)
        .set({ body: d.body, changeNote: d.changeNote ?? last.changeNote, updatedAt: new Date() })
        .where(eq(documentVersion.id, last.id));
      return { versionId: last.id, version: last.version, created: false };
    }
    const [v] = await tx
      .insert(documentVersion)
      .values({
        tenantId,
        documentId,
        version: last.version + 1,
        body: d.body,
        changeNote: d.changeNote,
        createdBy: userId,
        createdByName: userName,
      })
      .returning({ id: documentVersion.id });
    return { versionId: v.id, version: last.version + 1, created: true };
  });
}

/**
 * Aprueba la versión con firma simple. Quien aprueba debe ser distinto de quien redactó la versión. La anterior vigente pasa a
 * obsoleta y la nueva queda como vigente, con su próxima revisión. La huella cubre el contenido y los datos de la firma.
 */
export async function approveVersion(
  tenantId: string,
  userId: string,
  userName: string,
  versionId: string,
  signature: string,
  raw: unknown,
  ev: { ip?: string | null; userAgent?: string | null } = {},
) {
  const d = approveSchema.parse(raw);
  await assertWritable(tenantId);
  if (!isValidSignature(signature)) throw new DocumentError("Falta la firma o no es válida");
  const at = new Date();
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [v] = await tx
      .select()
      .from(documentVersion)
      .where(and(eq(documentVersion.id, versionId), eq(documentVersion.tenantId, tenantId)));
    if (!v) throw new DocumentError("Versión no encontrada");
    if (v.status !== "draft") throw new DocumentError("Solo se aprueban borradores");
    if (v.createdBy === userId)
      throw new DocumentError("Quien redacta el documento no puede aprobarlo");
    const [doc] = await tx.select().from(document).where(eq(document.id, v.documentId));
    if (doc.currentVersionId)
      await tx
        .update(documentVersion)
        .set({ status: "obsolete", updatedAt: at })
        .where(eq(documentVersion.id, doc.currentVersionId));
    await tx
      .update(documentVersion)
      .set({
        status: "approved",
        approvedBy: userId,
        approvedName: userName,
        approvedAt: at,
        signature,
        evidenceHash: hashEvidence([
          v.documentId,
          String(v.version),
          bodyHash(v.body),
          userId,
          at.toISOString(),
          signature,
          ev.ip ?? null,
          ev.userAgent ?? null,
        ]),
        effectiveFrom: d.effectiveFrom,
        nextReviewOn: nextReview(d.effectiveFrom, doc.reviewMonths),
        updatedAt: at,
      })
      .where(eq(documentVersion.id, versionId));
    await tx
      .update(document)
      .set({ currentVersionId: versionId, updatedAt: at })
      .where(eq(document.id, doc.id));
  });
}

/** Lista maestra: cada documento con su versión vigente, borrador pendiente y estado de revisión. */
export async function masterList(tenantId: string) {
  const warn = await getParameter("documentos.alerta_revision_dias", 30);
  const today = todayYmd();
  return withTenant(ctxOf(tenantId), async (tx) => {
    const docs = await tx
      .select()
      .from(document)
      .where(eq(document.tenantId, tenantId))
      .orderBy(asc(document.code));
    const versions = await tx
      .select()
      .from(documentVersion)
      .where(eq(documentVersion.tenantId, tenantId))
      .orderBy(desc(documentVersion.version));
    return docs.map((doc) => {
      const mine = versions.filter((v) => v.documentId === doc.id);
      const current = mine.find((v) => v.id === doc.currentVersionId) ?? null;
      const draft = mine.find((v) => v.status === "draft") ?? null;
      return {
        ...doc,
        current,
        draft,
        history: mine,
        review: reviewState(
          { currentApproved: Boolean(current), nextReviewOn: current?.nextReviewOn ?? null },
          today,
          warn,
        ),
      };
    });
  });
}

/** Política vigente de SST (para el portal del trabajador): la versión aprobada del documento de tipo política. */
export async function currentPolicy(tenantId: string) {
  return (await masterList(tenantId)).find((d) => d.kind === "policy" && d.current) ?? null;
}

export async function acknowledge(
  tenantId: string,
  userId: string,
  userName: string,
  versionId: string,
  ip: string | null,
) {
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [v] = await tx
      .select()
      .from(documentVersion)
      .where(and(eq(documentVersion.id, versionId), eq(documentVersion.tenantId, tenantId)));
    if (!v || v.status !== "approved")
      throw new DocumentError("Solo se acepta una versión vigente");
    await tx
      .insert(documentAck)
      .values({ tenantId, versionId, userId, userName, ip })
      .onConflictDoNothing();
  });
}
export async function acksFor(tenantId: string, versionId: string) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(documentAck)
      .where(and(eq(documentAck.tenantId, tenantId), eq(documentAck.versionId, versionId)))
      .orderBy(asc(documentAck.ackedAt)),
  );
}
export async function hasAcknowledged(tenantId: string, userId: string, versionId: string) {
  return (await acksFor(tenantId, versionId)).some((a) => a.userId === userId);
}

/** Plantillas del catálogo con las variables de la empresa ya reemplazadas. */
export async function templatesFor(tenantId: string) {
  const active = await getActiveItems<{ kind: string; name: string; body: string }>(
    "doc_templates",
  );
  if (!active?.items.length) return [];
  const [t] = await withTenant(ctxOf(tenantId), (tx) =>
    tx.select().from(tenant).where(eq(tenant.id, tenantId)),
  );
  const vars = {
    "empresa.razonSocial": t.legalName,
    "empresa.nombreComercial": t.tradeName,
    "empresa.nit": t.nit ? `${t.nit}${t.nitDv ? `-${t.nitDv}` : ""}` : null,
    "empresa.representante": t.legalRepresentative,
    "fecha.hoy": todayYmd(),
  };
  return active.items.map((i) => ({
    code: i.code,
    kind: i.kind,
    name: i.name,
    body: renderTemplate(i.body, vars),
  }));
}
