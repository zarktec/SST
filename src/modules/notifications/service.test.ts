import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, schema, withPlatform } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { devOutbox } from "@/core/mail";
import { createAction, moveAction } from "@/modules/capa/service";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import { calendarFor, listForUser, markRead, syncNotifications, unreadCount } from "./service";

pointToTestDb();
let n = 0;
const mk = () => createTenantWithSubscription(`no-${++n}`).then((t) => t.id);
const view = (...modules: string[]) => modules.map((module) => ({ module, action: "view" }));

async function admin(t: string, email: string) {
  await withPlatform({ actorId: "t", action: "t", tenantId: t, audit: false }, async (tx) => {
    const [role] = await tx
      .insert(schema.role)
      .values({ tenantId: t, systemKey: "RESPONSABLE_SST", name: "Resp" })
      .returning();
    await tx
      .insert(schema.user)
      .values({ id: `u-${t}`, name: "Resp", email, emailVerified: true })
      .onConflictDoNothing();
    await tx
      .insert(schema.membership)
      .values({ tenantId: t, userId: `u-${t}`, roleId: role.id, status: "active" });
  });
}

describe.skipIf(!hasTestDb)("notificaciones y calendario", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("crea la alerta una vez, envía correo solo de lo nuevo y la resuelve al corregirse", async () => {
    const t = await mk();
    await admin(t, `resp${n}@demo.test`);
    const id = await createAction(t, "u", {
      type: "corrective",
      title: "Reparar la baranda",
      responsibleName: "Luis",
      dueDate: "2020-01-01",
    });
    devOutbox.length = 0;
    const r1 = await syncNotifications(t);
    expect(r1.created).toBeGreaterThanOrEqual(1);
    const mails = devOutbox.filter((m) => m.to === `resp${n}@demo.test`);
    expect(mails).toHaveLength(1);
    expect(mails[0].html).toContain("acción vencida");
    devOutbox.length = 0;
    const r2 = await syncNotifications(t);
    expect(r2.created).toBe(0);
    expect(devOutbox).toHaveLength(0);
    const list = await listForUser(t, "reader", view("actions"));
    expect(list.find((x) => x.key === "capa-overdue")).toMatchObject({
      severity: "critical",
      read: false,
    });
    await moveAction(t, "u", id, "done", "Baranda reparada, acta 5").catch(() => undefined);
    await syncNotifications(t);
    expect(
      (await listForUser(t, "reader", view("actions"))).find((x) => x.key === "capa-overdue"),
    ).toBeUndefined();
  });

  it("solo ve las alertas de los módulos que puede consultar y lleva su propia lectura", async () => {
    const t = await mk();
    await createAction(t, "u", {
      type: "corrective",
      title: "Otra acción vencida",
      responsibleName: "Ana",
      dueDate: "2020-01-01",
    });
    await syncNotifications(t);
    expect(await listForUser(t, "u1", view("workers"))).toHaveLength(0);
    const mine = await listForUser(t, "u1", view("actions"));
    expect(await unreadCount(t, "u1", view("actions"))).toBe(mine.length);
    await markRead(
      t,
      "u1",
      mine.map((m) => m.id),
    );
    expect(await unreadCount(t, "u1", view("actions"))).toBe(0);
    expect(await unreadCount(t, "u2", view("actions"))).toBe(mine.length);
  });

  it("el calendario incluye las fechas límite de las acciones abiertas y respeta permisos", async () => {
    const t = await mk();
    await createAction(t, "u", {
      type: "corrective",
      title: "Acción con fecha",
      responsibleName: "Ana",
      dueDate: "2030-05-05",
    });
    const ev = await calendarFor(t, view("actions"));
    expect(ev.find((e) => e.date === "2030-05-05")?.title).toContain("Acción con fecha");
    expect(await calendarFor(t, view("workers"))).toHaveLength(0);
  });
});
