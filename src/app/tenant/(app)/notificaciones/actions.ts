"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireTenantMember } from "@/core/auth/session";
import { withTenant } from "@/core/db";
import { loadPermissions, permissionList } from "@/core/rbac/can";
import type { FormState } from "@/lib/form-state";
import {
  listForUser,
  markRead,
  removePushSubscription,
  savePushSubscription,
} from "@/modules/notifications/service";

export async function markAllReadAction(_arg: string): Promise<FormState> {
  void _arg;
  const ctx = await requireTenantMember();
  const perms = permissionList(
    await withTenant({ tenantId: ctx.tenant.tenantId }, (tx) => loadPermissions(tx, ctx.roleId)),
  );
  const open = await listForUser(ctx.tenant.tenantId, ctx.user.id, perms);
  await markRead(
    ctx.tenant.tenantId,
    ctx.user.id,
    open.filter((n) => !n.read).map((n) => n.id),
  );
  revalidatePath("/notificaciones", "layout");
  return { ok: true, message: "Marcadas como leídas." };
}

export async function markOneReadAction(id: string): Promise<FormState> {
  const ctx = await requireTenantMember();
  await markRead(ctx.tenant.tenantId, ctx.user.id, [id]);
  revalidatePath("/notificaciones", "layout");
  return { ok: true, message: "Leída." };
}

export async function subscribePushAction(json: string): Promise<FormState> {
  const ctx = await requireTenantMember();
  try {
    const sub = JSON.parse(json) as { endpoint: string; keys: { p256dh: string; auth: string } };
    await savePushSubscription(
      ctx.tenant.tenantId,
      ctx.user.id,
      sub,
      (await headers()).get("user-agent"),
    );
    return { ok: true, message: "Notificaciones activadas en este dispositivo." };
  } catch {
    return { ok: false, message: "No se pudo activar en este dispositivo." };
  }
}

export async function unsubscribePushAction(endpoint: string): Promise<FormState> {
  const ctx = await requireTenantMember();
  await removePushSubscription(ctx.tenant.tenantId, ctx.user.id, endpoint);
  return { ok: true, message: "Notificaciones desactivadas en este dispositivo." };
}
