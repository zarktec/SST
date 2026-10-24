import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";
import { schema, withPlatform, withTenant } from "@/core/db";
import { sendMail } from "@/core/mail";
import { assertCanAdd, assertWritable } from "@/core/plans/limits";
import { originFor, rootDomain } from "@/core/tenancy/hosts";
import { inviteSchema, leavesNoAdmin } from "./rules";

const { membership, invitation, role, user, tenant, auditLog } = schema;
export class UserAdminError extends Error {}
const sys = (tenantId: string, actorId: string, action: string) => ({
  actorId,
  action,
  tenantId,
  audit: false,
});

async function audit(
  tx: Parameters<Parameters<typeof withPlatform>[1]>[0],
  tenantId: string,
  actorId: string,
  action: string,
  entity: string,
  entityId: string,
  before: unknown,
  after: unknown,
) {
  await tx.insert(auditLog).values({
    tenantId,
    actorId,
    action,
    entity,
    entityId,
    before: before as never,
    after: after as never,
  });
}

export async function listRoles(tenantId: string) {
  return withTenant({ tenantId }, (tx) =>
    tx
      .select({ id: role.id, name: role.name, systemKey: role.systemKey })
      .from(role)
      .where(eq(role.tenantId, tenantId))
      .orderBy(asc(role.name)),
  );
}

/** Miembros (con su rol) e invitaciones pendientes de la empresa. */
export async function listTeam(tenantId: string) {
  const now = new Date();
  return withPlatform(sys(tenantId, "system", "users.list"), async (tx) => {
    const members = await tx
      .select({
        id: membership.id,
        userId: membership.userId,
        status: membership.status,
        roleId: membership.roleId,
        roleName: role.name,
        roleKey: role.systemKey,
        name: user.name,
        email: user.email,
        createdAt: membership.createdAt,
      })
      .from(membership)
      .innerJoin(user, eq(user.id, membership.userId))
      .innerJoin(role, eq(role.id, membership.roleId))
      .where(eq(membership.tenantId, tenantId))
      .orderBy(asc(user.name));
    const invites = await tx
      .select({
        id: invitation.id,
        email: invitation.email,
        roleName: role.name,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      })
      .from(invitation)
      .innerJoin(role, eq(role.id, invitation.roleId))
      .where(
        and(
          eq(invitation.tenantId, tenantId),
          isNull(invitation.acceptedAt),
          gt(invitation.expiresAt, now),
        ),
      )
      .orderBy(desc(invitation.createdAt));
    return { members, invites };
  });
}

/** Invita a una persona por correo con un rol. Entra con enlace mágico a la dirección de la empresa; el correo debe coincidir. */
export async function inviteUser(tenantId: string, actorId: string, raw: unknown) {
  const d = inviteSchema.parse(raw);
  await assertWritable(tenantId);
  await assertCanAdd(tenantId, "users");
  const info = await withPlatform(sys(tenantId, actorId, "users.invite"), async (tx) => {
    const [r] = await tx
      .select()
      .from(role)
      .where(and(eq(role.id, d.roleId), eq(role.tenantId, tenantId)));
    if (!r) throw new UserAdminError("Rol no encontrado");
    const [existing] = await tx
      .select({ status: membership.status })
      .from(membership)
      .innerJoin(user, eq(user.id, membership.userId))
      .where(and(eq(membership.tenantId, tenantId), eq(user.email, d.email)));
    if (existing?.status === "active")
      throw new UserAdminError("Esa persona ya es miembro de la empresa");
    const [t] = await tx
      .select({ slug: tenant.slug, name: tenant.tradeName })
      .from(tenant)
      .where(eq(tenant.id, tenantId));
    // Una sola invitación vigente por correo: la anterior se reemplaza.
    await tx
      .delete(invitation)
      .where(
        and(
          eq(invitation.tenantId, tenantId),
          eq(invitation.email, d.email),
          isNull(invitation.acceptedAt),
        ),
      );
    const [inv] = await tx
      .insert(invitation)
      .values({
        tenantId,
        email: d.email,
        roleId: d.roleId,
        tokenHash: randomBytes(16).toString("hex"),
        invitedBy: actorId,
        expiresAt: new Date(Date.now() + 14 * 86_400_000),
      })
      .returning({ id: invitation.id });
    await audit(tx, tenantId, actorId, "users.invite", "invitation", inv.id, null, {
      email: d.email,
      role: r.name,
    });
    return { slug: t.slug, name: t.name, role: r.name };
  });
  const host = `${info.slug}.${rootDomain()}`;
  await sendMail({
    to: d.email,
    subject: `Te invitaron a ${info.name} en SST`,
    html: `<p>Hola,</p><p>Te invitaron a <strong>${info.name}</strong> con el rol <strong>${info.role}</strong>. Ingresa en <a href="${originFor(host)}/login">${originFor(host)}/login</a> con este correo (te enviaremos un enlace de acceso). La invitación vence en 14 días.</p>`,
  }).catch(() => undefined);
}

export async function revokeInvitation(tenantId: string, actorId: string, id: string) {
  await withPlatform(sys(tenantId, actorId, "users.revoke_invitation"), async (tx) => {
    const r = await tx
      .delete(invitation)
      .where(
        and(
          eq(invitation.id, id),
          eq(invitation.tenantId, tenantId),
          isNull(invitation.acceptedAt),
        ),
      )
      .returning({ email: invitation.email });
    if (!r.length) throw new UserAdminError("Invitación no encontrada");
    await audit(
      tx,
      tenantId,
      actorId,
      "users.revoke_invitation",
      "invitation",
      id,
      { email: r[0].email },
      null,
    );
  });
}

async function loadMembers(
  tx: Parameters<Parameters<typeof withPlatform>[1]>[0],
  tenantId: string,
) {
  return tx
    .select({
      id: membership.id,
      userId: membership.userId,
      status: membership.status,
      roleId: membership.roleId,
      roleKey: role.systemKey,
      roleName: role.name,
    })
    .from(membership)
    .innerJoin(role, eq(role.id, membership.roleId))
    .where(eq(membership.tenantId, tenantId));
}

export async function changeRole(
  tenantId: string,
  actorId: string,
  memberId: string,
  roleId: string,
) {
  await assertWritable(tenantId);
  await withPlatform(sys(tenantId, actorId, "users.change_role"), async (tx) => {
    const members = await loadMembers(tx, tenantId);
    const m = members.find((x) => x.id === memberId);
    if (!m) throw new UserAdminError("Miembro no encontrado");
    if (m.userId === actorId) throw new UserAdminError("No puedes cambiar tu propio rol");
    const [r] = await tx
      .select()
      .from(role)
      .where(and(eq(role.id, roleId), eq(role.tenantId, tenantId)));
    if (!r) throw new UserAdminError("Rol no encontrado");
    if (leavesNoAdmin(members, { memberId, newRoleKey: r.systemKey }))
      throw new UserAdminError("La empresa debe conservar al menos un administrador activo");
    await tx
      .update(membership)
      .set({ roleId, updatedAt: new Date() })
      .where(eq(membership.id, memberId));
    await audit(
      tx,
      tenantId,
      actorId,
      "users.change_role",
      "membership",
      memberId,
      { role: m.roleName },
      { role: r.name },
    );
  });
}

export async function setMemberStatus(
  tenantId: string,
  actorId: string,
  memberId: string,
  status: "active" | "disabled",
) {
  await assertWritable(tenantId);
  // Reactivar a alguien desactivado vuelve a contar para el límite de usuarios del plan.
  if (status === "active") await assertCanAdd(tenantId, "users");
  await withPlatform(sys(tenantId, actorId, "users.set_status"), async (tx) => {
    const members = await loadMembers(tx, tenantId);
    const m = members.find((x) => x.id === memberId);
    if (!m) throw new UserAdminError("Miembro no encontrado");
    if (m.userId === actorId && status === "disabled")
      throw new UserAdminError("No puedes desactivar tu propia cuenta");
    if (status === "disabled" && leavesNoAdmin(members, { memberId, newStatus: "disabled" }))
      throw new UserAdminError("La empresa debe conservar al menos un administrador activo");
    await tx
      .update(membership)
      .set({ status, updatedAt: new Date() })
      .where(eq(membership.id, memberId));
    await audit(
      tx,
      tenantId,
      actorId,
      "users.set_status",
      "membership",
      memberId,
      { status: m.status },
      { status },
    );
  });
}
