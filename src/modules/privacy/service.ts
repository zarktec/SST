import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { schema, withTenant } from "@/core/db";
import { addBusinessDays, bogotaDate } from "@/core/calendar/business-days";
import { loadBusinessCalendar } from "@/core/calendar/service";
import { assertWritable } from "@/core/plans/limits";
import { getParameter } from "@/modules/platform/catalogs/service";
import { consentSchema, requestSchema, resolveSchema } from "./rules";

const { dataConsent, dataRequest } = schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });
export class PrivacyError extends Error {}

export const currentVersion = () => getParameter("privacidad.version", "2026-01");

export async function consentStatus(tenantId: string, userId: string) {
  const version = await currentVersion();
  const [c] = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(dataConsent)
      .where(
        and(
          eq(dataConsent.tenantId, tenantId),
          eq(dataConsent.userId, userId),
          eq(dataConsent.version, version),
        ),
      ),
  );
  return {
    version,
    accepted: Boolean(c?.general),
    sensitive: Boolean(c?.sensitive),
    acceptedAt: c?.acceptedAt ?? null,
  };
}

/** Registra la autorización de la versión vigente del aviso (la general es obligatoria; la de datos sensibles es opcional y separada). */
export async function acceptConsent(
  tenantId: string,
  userId: string,
  raw: unknown,
  ev: { ip?: string | null; userAgent?: string | null } = {},
) {
  const d = consentSchema.parse(raw);
  if (!d.general)
    throw new PrivacyError(
      "Debes autorizar el tratamiento de datos personales para usar la plataforma",
    );
  const version = await currentVersion();
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .insert(dataConsent)
      .values({
        tenantId,
        userId,
        version,
        general: true,
        sensitive: d.sensitive,
        ip: ev.ip ?? null,
        userAgent: ev.userAgent?.slice(0, 300) ?? null,
      })
      .onConflictDoUpdate({
        target: [dataConsent.tenantId, dataConsent.userId, dataConsent.version],
        set: { sensitive: d.sensitive, acceptedAt: new Date(), ip: ev.ip ?? null },
      }),
  );
}

/** Radica una solicitud del titular; el plazo de respuesta se cuenta en días hábiles (parametrizable). */
export async function createRequest(
  tenantId: string,
  user: { id: string; name: string; email: string },
  raw: unknown,
) {
  const d = requestSchema.parse(raw);
  await assertWritable(tenantId);
  const days = await getParameter(
    d.type === "query" ? "privacidad.plazo_consulta_dias" : "privacidad.plazo_reclamo_dias",
    d.type === "query" ? 10 : 15,
  );
  const today = bogotaDate(new Date());
  const y = Number(today.slice(0, 4));
  const dueOn = addBusinessDays(today, days, await loadBusinessCalendar(y, y + 1));
  return withTenant(ctxOf(tenantId, user.id), async (tx) => {
    const [r] = await tx
      .insert(dataRequest)
      .values({
        tenantId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        type: d.type,
        detail: d.detail,
        dueOn,
      })
      .returning({ id: dataRequest.id });
    return { id: r.id, dueOn };
  });
}

export async function listRequests(tenantId: string, opts: { userId?: string } = {}) {
  const today = bogotaDate(new Date());
  const rows = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(dataRequest)
      .where(
        opts.userId
          ? and(eq(dataRequest.tenantId, tenantId), eq(dataRequest.userId, opts.userId))
          : eq(dataRequest.tenantId, tenantId),
      )
      .orderBy(desc(dataRequest.createdAt)),
  );
  return rows.map((r) => ({ ...r, overdue: r.status === "open" && r.dueOn < today }));
}

export async function resolveRequest(tenantId: string, userId: string, id: string, raw: unknown) {
  const d = resolveSchema.parse(raw);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const r = await tx
      .update(dataRequest)
      .set({
        status: d.decision,
        resolution: d.resolution,
        resolvedBy: userId,
        resolvedAt: new Date(),
      })
      .where(
        and(
          eq(dataRequest.id, id),
          eq(dataRequest.tenantId, tenantId),
          eq(dataRequest.status, "open"),
        ),
      )
      .returning({ id: dataRequest.id });
    if (!r.length) throw new PrivacyError("Solicitud no encontrada o ya respondida");
  });
}
