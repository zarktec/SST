import "server-only";
import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import webpush from "web-push";
import { schema, withPlatform, withTenant } from "@/core/db";
import { sendMail } from "@/core/mail";
import { emailsForRoles } from "@/core/notify/recipients";
import { originFor, rootDomain } from "@/core/tenancy/hosts";
import { collectAlerts, collectEvents } from "./collect";
import { bySeverity, diffAlerts, digestHtml, icsCalendar, type AlertItem } from "./rules";

const { notification, notificationRead, pushSubscription, tenant } = schema;
const ctxOf = (tenantId: string, userId?: string) => ({ tenantId, userId });

const tenantOrigin = (slug: string) => originFor(`${slug}.${rootDomain()}`);

/**
 * Sincroniza las notificaciones de la empresa con las alertas vigentes: crea las nuevas, actualiza las que siguen, resuelve las que
 * ya no aplican y envía correo/push SOLO de las nuevas (críticas y advertencias). Con `weekly` envía además el resumen de todo lo abierto.
 */
export async function syncNotifications(tenantId: string, opts: { weekly?: boolean } = {}) {
  const collected = await collectAlerts(tenantId);
  const now = new Date();
  const existing = await withTenant(ctxOf(tenantId), (tx) =>
    tx.select().from(notification).where(eq(notification.tenantId, tenantId)),
  );
  const d = diffAlerts(existing, collected);
  const fresh = [...d.created, ...d.reopened];
  await withTenant(ctxOf(tenantId), async (tx) => {
    for (const a of collected) {
      const values = {
        module: a.module,
        severity: a.severity,
        title: a.title,
        detail: a.detail ?? null,
        href: a.href ?? null,
        dueOn: a.dueOn ?? null,
        lastSeenAt: now,
        resolvedAt: null,
        updatedAt: now,
      };
      await tx
        .insert(notification)
        .values({ tenantId, key: a.key, ...values, firstSeenAt: now })
        .onConflictDoUpdate({
          target: [notification.tenantId, notification.key],
          set: {
            ...values,
            ...(fresh.some((f) => f.key === a.key) ? { firstSeenAt: now, notifiedAt: null } : {}),
          },
        });
    }
    if (d.resolved.length)
      await tx
        .update(notification)
        .set({ resolvedAt: now, updatedAt: now })
        .where(and(eq(notification.tenantId, tenantId), inArray(notification.key, d.resolved)));
  });
  const toSend = fresh.filter((a) => a.severity !== "info");
  const [t] = await withPlatform(
    { actorId: "system", action: "notify.tenant", tenantId, audit: false },
    (tx) => tx.select({ slug: tenant.slug }).from(tenant).where(eq(tenant.id, tenantId)),
  );
  const origin = t ? tenantOrigin(t.slug) : "";
  let emailed = 0;
  const send = async (items: AlertItem[], subject: string, intro: string) => {
    if (!items.length) return;
    const to = await emailsForRoles(tenantId, ["RESPONSABLE_SST", "ADMIN_EMPRESA"]);
    await Promise.all(
      to.map((email) =>
        sendMail({ to: email, subject, html: digestHtml(intro, items, origin) }).then(
          () => emailed++,
          () => undefined,
        ),
      ),
    );
  };
  await send(
    toSend,
    `SST: ${toSend.length} alerta(s) nueva(s)`,
    "Estas alertas nuevas requieren tu atención:",
  );
  if (opts.weekly) {
    const open = collected;
    await send(
      open,
      `SST: resumen semanal (${open.length} alerta(s) abierta(s))`,
      "Resumen semanal del estado del SG-SST:",
    );
  }
  const pushed = await sendPush(tenantId, toSend, origin).catch(() => 0);
  if (toSend.length)
    await withTenant(ctxOf(tenantId), (tx) =>
      tx
        .update(notification)
        .set({ notifiedAt: now })
        .where(
          and(
            eq(notification.tenantId, tenantId),
            inArray(
              notification.key,
              toSend.map((a) => a.key),
            ),
          ),
        ),
    );
  return {
    active: collected.length,
    created: d.created.length,
    resolved: d.resolved.length,
    emailed,
    pushed,
  };
}

/** Lo corre el cron diario; los lunes (hora de Colombia) incluye el resumen semanal. */
export async function syncNotificationsAll(now = new Date()) {
  const tenants = await withPlatform(
    { actorId: "system", action: "notify.tenants", audit: false },
    (tx) => tx.select({ id: tenant.id }).from(tenant).where(ne(tenant.status, "cancelled")),
  );
  const monday = new Date(now.getTime() - 5 * 3_600_000).getUTCDay() === 1;
  let created = 0;
  for (const t of tenants) {
    const r = await syncNotifications(t.id, { weekly: monday }).catch(() => null);
    created += r?.created ?? 0;
  }
  return created;
}

type Perms = { module: string; action: string }[];
const canView = (perms: Perms, module: string) =>
  perms.some((p) => p.module === module && p.action === "view");

/** Notificaciones abiertas que el usuario puede ver por sus permisos, con su estado de lectura. */
export async function listForUser(
  tenantId: string,
  userId: string,
  perms: Perms,
  opts: { includeResolved?: boolean } = {},
) {
  const [rows, reads] = await Promise.all([
    withTenant(ctxOf(tenantId), (tx) =>
      tx
        .select()
        .from(notification)
        .where(
          opts.includeResolved
            ? eq(notification.tenantId, tenantId)
            : and(eq(notification.tenantId, tenantId), isNull(notification.resolvedAt)),
        )
        .orderBy(desc(notification.firstSeenAt)),
    ),
    withTenant(ctxOf(tenantId), (tx) =>
      tx
        .select({ id: notificationRead.notificationId })
        .from(notificationRead)
        .where(and(eq(notificationRead.tenantId, tenantId), eq(notificationRead.userId, userId))),
    ),
  ]);
  const read = new Set(reads.map((r) => r.id));
  return bySeverity(
    rows.filter((r) => canView(perms, r.module)) as ((typeof rows)[number] & {
      severity: AlertItem["severity"];
    })[],
  ).map((r) => ({
    ...r,
    read: read.has(r.id),
  }));
}

export async function unreadCount(tenantId: string, userId: string, perms: Perms) {
  return (await listForUser(tenantId, userId, perms)).filter((n) => !n.read).length;
}

export async function markRead(tenantId: string, userId: string, ids: string[]) {
  if (!ids.length) return;
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .insert(notificationRead)
      .values(ids.map((id) => ({ tenantId, notificationId: id, userId })))
      .onConflictDoNothing(),
  );
}

/** Eventos del calendario visibles para el usuario. */
export async function calendarFor(tenantId: string, perms: Perms) {
  return (await collectEvents(tenantId)).filter((e) => canView(perms, e.module));
}
export async function icsFor(
  tenantId: string,
  tenantName: string,
  slug: string,
  perms: Perms,
  now = new Date(),
) {
  return icsCalendar(
    await calendarFor(tenantId, perms),
    `Obligaciones SG-SST · ${tenantName}`,
    tenantOrigin(slug),
    now,
  );
}

// ---------- Web Push (PWA) ----------
export const pushConfigured = () =>
  Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? "";

export async function savePushSubscription(
  tenantId: string,
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent: string | null,
) {
  if (!/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth)
    throw new Error("Suscripción inválida");
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .insert(pushSubscription)
      .values({
        tenantId,
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent: userAgent?.slice(0, 300) ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscription.endpoint,
        set: { tenantId, userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      }),
  );
}
export async function removePushSubscription(tenantId: string, userId: string, endpoint: string) {
  await withTenant(ctxOf(tenantId, userId), (tx) =>
    tx
      .delete(pushSubscription)
      .where(
        and(
          eq(pushSubscription.tenantId, tenantId),
          eq(pushSubscription.userId, userId),
          eq(pushSubscription.endpoint, endpoint),
        ),
      ),
  );
}

/** Envía un push con el resumen de las alertas nuevas a los dispositivos suscritos. Sin llaves VAPID no hace nada. */
async function sendPush(tenantId: string, items: AlertItem[], origin: string): Promise<number> {
  if (!items.length || !pushConfigured()) return 0;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:soporte@sst.zark.pro",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const subs = await withTenant(ctxOf(tenantId), (tx) =>
    tx.select().from(pushSubscription).where(eq(pushSubscription.tenantId, tenantId)),
  );
  const top = bySeverity(items)[0];
  const payload = JSON.stringify({
    title: items.length === 1 ? top.title : `${items.length} alertas nuevas del SG-SST`,
    body: items.length === 1 ? (top.detail ?? "") : top.title,
    url: `${origin}/notificaciones`,
  });
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 86_400 },
      );
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410)
        await withTenant(ctxOf(tenantId), (tx) =>
          tx.delete(pushSubscription).where(eq(pushSubscription.id, s.id)),
        );
    }
  }
  return sent;
}
