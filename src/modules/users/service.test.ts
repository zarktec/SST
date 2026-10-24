import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, schema, withPlatform } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { devOutbox } from "@/core/mail";
import { changeRole, inviteUser, listTeam, revokeInvitation, setMemberStatus } from "./service";

pointToTestDb();
let n = 0;

async function setup() {
  const t = (await createTenantWithSubscription(`us-${++n}`)).id;
  const sys = { actorId: "x", action: "x", tenantId: t, audit: false };
  return withPlatform(sys, async (tx) => {
    const [admin] = await tx
      .insert(schema.role)
      .values({ tenantId: t, systemKey: "ADMIN_EMPRESA", name: "Admin" })
      .returning();
    const [worker] = await tx
      .insert(schema.role)
      .values({ tenantId: t, systemKey: "TRABAJADOR", name: "Trabajador" })
      .returning();
    const ids = [`ua-${t}`, `ub-${t}`];
    await tx
      .insert(schema.user)
      .values(
        ids.map((id, i) => ({ id, name: `U${i}`, email: `${id}@x.co`, emailVerified: true })),
      );
    const [ma, mb] = await tx
      .insert(schema.membership)
      .values([
        { tenantId: t, userId: ids[0], roleId: admin.id, status: "active" as const },
        { tenantId: t, userId: ids[1], roleId: worker.id, status: "active" as const },
      ])
      .returning();
    return { t, admin, worker, ma, mb, actor: ids[0] };
  });
}

describe.skipIf(!hasTestDb)("usuarios y roles", () => {
  afterAll(closeDb);
  beforeAll(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  it("invita, reemplaza la invitación anterior y permite revocarla", async () => {
    const s = await setup();
    devOutbox.length = 0;
    await inviteUser(s.t, s.actor, { email: "Nueva@X.co", roleId: s.worker.id });
    await inviteUser(s.t, s.actor, { email: "nueva@x.co", roleId: s.admin.id });
    const { invites } = await listTeam(s.t);
    expect(invites).toHaveLength(1);
    expect(invites[0].roleName).toBe("Admin");
    expect(devOutbox).toHaveLength(2);
    await revokeInvitation(s.t, s.actor, invites[0].id);
    expect((await listTeam(s.t)).invites).toHaveLength(0);
  });

  it("no invita a quien ya es miembro ni usa roles de otra empresa", async () => {
    const s = await setup();
    const o = await setup();
    await expect(
      inviteUser(s.t, s.actor, { email: `ub-${s.t}@x.co`, roleId: s.worker.id }),
    ).rejects.toThrow(/ya es miembro/);
    await expect(
      inviteUser(s.t, s.actor, { email: "z@x.co", roleId: o.worker.id }),
    ).rejects.toThrow(/Rol no encontrado/);
  });

  it("conserva siempre un administrador activo y no permite autoeliminarse", async () => {
    const s = await setup();
    await expect(changeRole(s.t, "otro", s.ma.id, s.worker.id)).rejects.toThrow(
      /al menos un administrador/,
    );
    await expect(changeRole(s.t, s.actor, s.ma.id, s.worker.id)).rejects.toThrow(/propio rol/);
    await expect(setMemberStatus(s.t, s.actor, s.ma.id, "disabled")).rejects.toThrow(
      /propia cuenta/,
    );
    await changeRole(s.t, s.actor, s.mb.id, s.admin.id);
    await setMemberStatus(s.t, s.actor, s.mb.id, "disabled");
    await setMemberStatus(s.t, s.actor, s.mb.id, "active");
    const { members } = await listTeam(s.t);
    expect(members.find((m) => m.id === s.mb.id)).toMatchObject({
      roleKey: "ADMIN_EMPRESA",
      status: "active",
    });
  });

  it("aísla por empresa", async () => {
    const a = await setup();
    const b = await setup();
    await expect(changeRole(b.t, "otro", a.mb.id, b.admin.id)).rejects.toThrow(/no encontrado/);
  });
});
