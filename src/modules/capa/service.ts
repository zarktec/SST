import "server-only";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { schema, withPlatform, withTenant } from "@/core/db";
import { sendMail } from "@/core/mail";
import { emailsForRoles } from "@/core/notify/recipients";
import { assertWritable } from "@/core/plans/limits";
import { todayYmd } from "@/lib/dates";
import { getParameter } from "@/modules/platform/catalogs/service";
import {
  LEVEL_ROLES,
  STATUS_LABEL,
  actionSchema,
  canMove,
  daysOverdue,
  escalationLevel,
  verifySchema,
  type ActionInput,
  type Status,
} from "./rules";

const { correctiveAction, tenant } = schema;
export type Action = typeof correctiveAction.$inferSelect;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });

export class CapaError extends Error {}

export async function createAction(
  tenantId: string,
  userId: string,
  input: ActionInput,
  origin: { source?: string; sourceId?: string } = {},
) {
  const d = actionSchema.parse(input);
  await assertWritable(tenantId);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    if (origin.source && origin.sourceId) {
      const [dup] = await tx
        .select({ id: correctiveAction.id })
        .from(correctiveAction)
        .where(
          and(
            eq(correctiveAction.tenantId, tenantId),
            eq(correctiveAction.source, origin.source),
            eq(correctiveAction.sourceId, origin.sourceId),
          ),
        );
      if (dup) return dup.id; // idempotente: el mismo origen no genera dos acciones
    }
    const [a] = await tx
      .insert(correctiveAction)
      .values({
        tenantId,
        ...d,
        source: origin.source ?? "manual",
        sourceId: origin.sourceId ?? null,
        createdBy: userId,
      })
      .returning({ id: correctiveAction.id });
    return a.id;
  });
}

export async function updateAction(
  tenantId: string,
  userId: string,
  id: string,
  input: Partial<Pick<ActionInput, "rootCause" | "responsibleName" | "dueDate" | "description">>,
) {
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [a] = await tx
      .select()
      .from(correctiveAction)
      .where(and(eq(correctiveAction.id, id), eq(correctiveAction.tenantId, tenantId)));
    if (!a) throw new CapaError("Acción no encontrada");
    if (a.status === "verified" || a.status === "cancelled")
      throw new CapaError("La acción ya está cerrada");
    const d = actionSchema.partial().parse(input);
    await tx
      .update(correctiveAction)
      .set({ ...d, updatedAt: new Date() })
      .where(eq(correctiveAction.id, id));
  });
}

/** Cambia de estado respetando el flujo; ejecutar exige evidencia de cierre y cancelar un motivo. */
export async function moveAction(
  tenantId: string,
  userId: string,
  id: string,
  to: Status,
  note?: string,
) {
  await assertWritable(tenantId);
  await withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [a] = await tx
      .select()
      .from(correctiveAction)
      .where(and(eq(correctiveAction.id, id), eq(correctiveAction.tenantId, tenantId)));
    if (!a) throw new CapaError("Acción no encontrada");
    if (!canMove(a.status as Status, to))
      throw new CapaError(
        `No se puede pasar de «${STATUS_LABEL[a.status as Status]}» a «${STATUS_LABEL[to]}»`,
      );
    if (to === "done" && !note?.trim()) throw new CapaError("Registra la evidencia del cierre");
    if (to === "cancelled" && !note?.trim())
      throw new CapaError("Indica el motivo de la cancelación");
    await tx
      .update(correctiveAction)
      .set({
        status: to,
        closureEvidence: to === "done" || to === "cancelled" ? note!.trim() : a.closureEvidence,
        closedAt: to === "done" || to === "cancelled" ? new Date() : a.closedAt,
        updatedAt: new Date(),
      })
      .where(eq(correctiveAction.id, id));
  });
}

/**
 * Verificación de eficacia posterior al cierre. Si no fue eficaz se abre una nueva acción correctiva vinculada (no se reabre
 * la anterior: queda el historial).
 */
export async function verifyEffectiveness(
  tenantId: string,
  userId: string,
  id: string,
  input: { effective: string; note: string },
) {
  const v = verifySchema.parse(input);
  await assertWritable(tenantId);
  const followUpDue = new Date(Date.now() + 15 * 86_400_000).toISOString().slice(0, 10);
  return withTenant(ctxOf(tenantId, userId), async (tx) => {
    const [a] = await tx
      .select()
      .from(correctiveAction)
      .where(and(eq(correctiveAction.id, id), eq(correctiveAction.tenantId, tenantId)));
    if (!a) throw new CapaError("Acción no encontrada");
    if (a.status !== "done") throw new CapaError("Solo se verifica una acción ejecutada");
    await tx
      .update(correctiveAction)
      .set({
        status: "verified",
        effective: v.effective,
        effectivenessNote: v.note,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(correctiveAction.id, id));
    if (v.effective === "no") {
      const [n] = await tx
        .insert(correctiveAction)
        .values({
          tenantId,
          type: "corrective",
          source: "capa",
          sourceId: id,
          title: `Nueva acción: la anterior no fue eficaz — ${a.title}`.slice(0, 200),
          description: v.note,
          responsibleName: a.responsibleName,
          dueDate: followUpDue,
          createdBy: userId,
        })
        .returning({ id: correctiveAction.id });
      return { followUpId: n.id };
    }
    return { followUpId: null };
  });
}

export async function listActions(
  tenantId: string,
  f: { status?: "open" | "all"; source?: string; limit?: number; offset?: number } = {},
) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const rows = await tx
      .select()
      .from(correctiveAction)
      .where(
        and(
          eq(correctiveAction.tenantId, tenantId),
          f.source ? eq(correctiveAction.source, f.source) : undefined,
          f.status === "open"
            ? inArray(correctiveAction.status, ["open", "in_progress", "done"])
            : undefined,
        ),
      )
      .orderBy(asc(correctiveAction.dueDate), asc(correctiveAction.id))
      .limit(f.limit ?? 100_000)
      .offset(f.offset ?? 0);
    const t = todayYmd();
    return rows.map((a) => ({ ...a, overdueDays: daysOverdue(a, t) }));
  });
}

export async function countActions(tenantId: string, f: { status?: "open" | "all" } = {}) {
  return withTenant(ctxOf(tenantId), async (tx) => {
    const [r] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(correctiveAction)
      .where(
        and(
          eq(correctiveAction.tenantId, tenantId),
          f.status === "open"
            ? inArray(correctiveAction.status, ["open", "in_progress", "done"])
            : undefined,
        ),
      );
    return r.n;
  });
}

export async function getAction(tenantId: string, id: string) {
  return (await listActions(tenantId, { status: "all" })).find((a) => a.id === id) ?? null;
}

export async function capaSummary(tenantId: string) {
  const rows = await listActions(tenantId, { status: "all" });
  const open = rows.filter((a) => a.status === "open" || a.status === "in_progress");
  return {
    open: open.length,
    overdue: open.filter((a) => a.overdueDays > 0).length,
    awaitingVerification: rows.filter((a) => a.status === "done").length,
    total: rows.length,
  };
}

/**
 * Escalamiento automático (lo corre el cron diario): sube el nivel de las acciones vencidas según su mora y avisa por correo
 * al nivel correspondiente (responsable del SG-SST → administración → alta dirección). Umbrales parametrizables.
 */
export async function runEscalation(tenantId: string, today = todayYmd()) {
  const [level1, level2, level3] = await Promise.all([
    getParameter("capa.escalar_nivel1_dias", 1),
    getParameter("capa.escalar_nivel2_dias", 15),
    getParameter("capa.escalar_nivel3_dias", 30),
  ]);
  const days = { level1, level2, level3 };
  const rows = await withTenant(ctxOf(tenantId), (tx) =>
    tx
      .select()
      .from(correctiveAction)
      .where(
        and(
          eq(correctiveAction.tenantId, tenantId),
          inArray(correctiveAction.status, ["open", "in_progress"]),
        ),
      ),
  );
  const raised: { id: string; level: number }[] = [];
  for (const a of rows) {
    const level = escalationLevel(daysOverdue(a, today), days);
    if (level <= a.escalationLevel) continue;
    await withTenant(ctxOf(tenantId), (tx) =>
      tx
        .update(correctiveAction)
        .set({ escalationLevel: level, escalatedAt: new Date(), updatedAt: new Date() })
        .where(eq(correctiveAction.id, a.id)),
    );
    const to = await emailsForRoles(tenantId, LEVEL_ROLES[level as 1 | 2 | 3]);
    await Promise.all(
      to.map((email) =>
        sendMail({
          to: email,
          subject: `Acción vencida (nivel ${level}): ${a.title}`,
          html: `<p>La acción «${a.title}» (responsable: ${a.responsibleName ?? "—"}) venció el ${a.dueDate} y lleva ${daysOverdue(a, today)} días de mora.</p>`,
        }).catch(() => undefined),
      ),
    );
    raised.push({ id: a.id, level });
  }
  return raised;
}

/** Corre el escalamiento en todas las empresas activas (cron diario). */
export async function runEscalationAll(today = todayYmd()) {
  const tenants = await withPlatform(
    { actorId: "system", action: "capa.escalation.tenants", audit: false },
    (tx) => tx.select({ id: tenant.id }).from(tenant).where(ne(tenant.status, "cancelled")),
  );
  let raised = 0;
  for (const t of tenants) raised += (await runEscalation(t.id, today).catch(() => [])).length;
  return raised;
}
