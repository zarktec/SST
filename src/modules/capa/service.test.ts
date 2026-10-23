import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { closeDb, schema, withPlatform } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { devOutbox } from "@/core/mail";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import {
  capaSummary,
  createAction,
  getAction,
  listActions,
  moveAction,
  runEscalation,
  updateAction,
  verifyEffectiveness,
} from "./service";

pointToTestDb();
let n = 0;
const mk = () => createTenantWithSubscription(`ca-${++n}`).then((t) => t.id);
const base = {
  type: "corrective" as const,
  title: "Reparar la baranda de la escalera",
  responsibleName: "Luis Gómez",
  dueDate: "2026-12-01",
};

describe.skipIf(!hasTestDb)("acciones correctivas, preventivas y de mejora", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("flujo completo: abrir, ejecutar con evidencia, verificar eficacia", async () => {
    const t = await mk();
    const id = await createAction(t, "u", base);
    await expect(moveAction(t, "u", id, "verified")).rejects.toThrow(/No se puede pasar/);
    await expect(moveAction(t, "u", id, "done", " ")).rejects.toThrow(/evidencia/);
    await moveAction(t, "u", id, "in_progress");
    await moveAction(t, "u", id, "done", "Baranda reparada, ver acta 5");
    expect(
      await verifyEffectiveness(t, "u", id, {
        effective: "yes",
        note: "Sin nuevos eventos en 30 días",
      }),
    ).toEqual({ followUpId: null });
    expect(await getAction(t, id)).toMatchObject({ status: "verified", effective: "yes" });
    await expect(updateAction(t, "u", id, { responsibleName: "Otro" })).rejects.toThrow(/cerrada/);
  });

  it("si la eficacia no se logra abre una nueva acción vinculada", async () => {
    const t = await mk();
    const id = await createAction(t, "u", base);
    await moveAction(t, "u", id, "done", "Hecho");
    const r = await verifyEffectiveness(t, "u", id, {
      effective: "no",
      note: "El evento se repitió la semana siguiente",
    });
    expect(r.followUpId).toBeTruthy();
    expect(await getAction(t, r.followUpId!)).toMatchObject({
      source: "capa",
      sourceId: id,
      status: "open",
    });
    await expect(
      verifyEffectiveness(t, "u", id, { effective: "yes", note: "de nuevo" }),
    ).rejects.toThrow(/ejecutada/);
  });

  it("el mismo origen no genera dos acciones", async () => {
    const t = await mk();
    const a = await createAction(t, "u", base, { source: "inspection", sourceId: "insp-1:item-3" });
    const b = await createAction(t, "u", base, { source: "inspection", sourceId: "insp-1:item-3" });
    expect(b).toBe(a);
    expect(await listActions(t, { source: "inspection" })).toHaveLength(1);
  });

  it("resumen y mora", async () => {
    const t = await mk();
    await createAction(t, "u", { ...base, dueDate: "2020-01-01" });
    const ok = await createAction(t, "u", base);
    await moveAction(t, "u", ok, "done", "evidencia");
    expect(await capaSummary(t)).toEqual({
      open: 1,
      overdue: 1,
      awaitingVerification: 1,
      total: 2,
    });
  });

  it("escala las vencidas por niveles y avisa a los roles correspondientes; no repite el mismo nivel", async () => {
    const t = await mk();
    await withPlatform({ actorId: "x", action: "x", tenantId: t, audit: false }, async (tx) => {
      const [role] = await tx
        .insert(schema.role)
        .values({ tenantId: t, systemKey: "RESPONSABLE_SST", name: "Resp" })
        .returning();
      await tx
        .insert(schema.user)
        .values({ id: `u-${t}`, name: "R", email: `resp-${n}@x.co`, emailVerified: true })
        .onConflictDoNothing();
      await tx
        .insert(schema.membership)
        .values({ tenantId: t, userId: `u-${t}`, roleId: role.id, status: "active" });
    });
    const id = await createAction(t, "u", { ...base, dueDate: "2026-10-01" });
    devOutbox.length = 0;
    expect(await runEscalation(t, "2026-10-01")).toEqual([]);
    expect(await runEscalation(t, "2026-10-03")).toEqual([{ id, level: 1 }]);
    expect(devOutbox).toHaveLength(1);
    expect(await runEscalation(t, "2026-10-04")).toEqual([]); // mismo nivel: no repite
    expect(await runEscalation(t, "2026-10-20")).toEqual([{ id, level: 2 }]);
    expect(await runEscalation(t, "2026-12-01")).toEqual([{ id, level: 3 }]);
    const [row] = await withPlatform(
      { actorId: "x", action: "x", tenantId: t, audit: false },
      (tx) => tx.select().from(schema.correctiveAction).where(eq(schema.correctiveAction.id, id)),
    );
    expect(row.escalationLevel).toBe(3);
  });

  it("aísla por empresa", async () => {
    const a = await mk();
    const b = await mk();
    const id = await createAction(a, "u", base);
    expect(await getAction(b, id)).toBeNull();
    await expect(moveAction(b, "u", id, "in_progress")).rejects.toThrow(/no encontrada/);
  });
});
