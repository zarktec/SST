import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { schema, withTenant } from "@/core/db";
import { sendMail } from "@/core/mail";
import { emailsForRoles } from "@/core/notify/recipients";
import { assertWritable } from "@/core/plans/limits";
import { createAction } from "@/modules/capa/service";
import { reportSchema, reviewSchema, type ReportInput, type ReviewInput } from "./rules";

const { unsafeReport, workCenter } = schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });

export class UnsafeReportError extends Error {}

/** Registra el reporte. Si es anónimo no se guarda quién lo hizo. Los de severidad alta avisan de inmediato al responsable. */
export async function createReport(tenantId: string, userId: string, input: ReportInput) {
  const d = reportSchema.parse(input);
  await assertWritable(tenantId);
  const id = await withTenant(ctxOf(tenantId, d.anonymous ? undefined : userId), async (tx) => {
    const [r] = await tx
      .insert(unsafeReport)
      .values({
        tenantId,
        kind: d.kind,
        description: d.description,
        place: d.place,
        workCenterId: d.workCenterId,
        severity: d.severity,
        latitude: d.latitude,
        longitude: d.longitude,
        anonymous: d.anonymous,
        reportedBy: d.anonymous ? null : userId,
      })
      .returning({ id: unsafeReport.id });
    return r.id;
  });
  if (d.severity === "high") {
    const to = await emailsForRoles(tenantId, ["RESPONSABLE_SST", "ADMIN_EMPRESA"]);
    await Promise.all(
      to.map((email) =>
        sendMail({
          to: email,
          subject: "Reporte de condición o acto inseguro de severidad alta",
          html: `<p>${d.kind === "act" ? "Acto" : "Condición"} inseguro reportado${d.place ? ` en ${d.place}` : ""}: ${d.description.replace(/</g, "&lt;")}</p>`,
        }).catch(() => undefined),
      ),
    );
  }
  return id;
}

/** Revisores ven todos; quien solo puede reportar ve únicamente los propios no anónimos. */
export async function listReports(
  tenantId: string,
  opts: { all: boolean; userId: string; limit?: number; offset?: number },
) {
  return withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ r: unsafeReport, center: workCenter.name })
      .from(unsafeReport)
      .leftJoin(workCenter, eq(workCenter.id, unsafeReport.workCenterId))
      .where(
        opts.all
          ? eq(unsafeReport.tenantId, tenantId)
          : and(eq(unsafeReport.tenantId, tenantId), eq(unsafeReport.reportedBy, opts.userId)),
      )
      .orderBy(desc(unsafeReport.createdAt), desc(unsafeReport.id))
      .limit(opts.limit ?? 1000)
      .offset(opts.offset ?? 0)
      .then((rows) => rows.map((x) => ({ ...x.r, center: x.center }))),
  );
}

export async function countReports(tenantId: string, opts: { all: boolean; userId: string }) {
  const [r] = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(unsafeReport)
      .where(
        opts.all
          ? eq(unsafeReport.tenantId, tenantId)
          : and(eq(unsafeReport.tenantId, tenantId), eq(unsafeReport.reportedBy, opts.userId)),
      ),
  );
  return r.n;
}

/** El revisor convierte el reporte en una acción del módulo CAPA o lo descarta con motivo. */
export async function reviewReport(
  tenantId: string,
  userId: string,
  id: string,
  input: ReviewInput,
) {
  const d = reviewSchema.parse(input);
  await assertWritable(tenantId);
  const [r] = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(unsafeReport)
      .where(and(eq(unsafeReport.id, id), eq(unsafeReport.tenantId, tenantId))),
  );
  if (!r) throw new UnsafeReportError("Reporte no encontrado");
  if (r.status !== "new") throw new UnsafeReportError("El reporte ya fue revisado");
  const actionId =
    d.decision === "action"
      ? await createAction(
          tenantId,
          userId,
          {
            type: "corrective",
            title: d.title,
            description: r.description,
            responsibleName: d.responsibleName,
            dueDate: d.dueDate,
          },
          { source: "unsafe_report", sourceId: id },
        )
      : null;
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .update(unsafeReport)
      .set({
        status: d.decision === "action" ? "actioned" : "dismissed",
        reviewNote: d.note || null,
        reviewedBy: userId,
        reviewedAt: new Date(),
        actionId,
        updatedAt: new Date(),
      })
      .where(and(eq(unsafeReport.id, id), eq(unsafeReport.status, "new"))),
  );
  return actionId;
}
