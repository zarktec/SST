import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, schema, withPlatform } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import {
  DocumentError,
  acknowledge,
  acksFor,
  approveVersion,
  createDocument,
  currentPolicy,
  masterList,
  saveDraft,
} from "./service";

pointToTestDb();
const sig = `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(400, 7)]).toString("base64")}`;
let n = 0;
const mk = () => createTenantWithSubscription(`dc-${++n}`).then((t) => t.id);
const base = {
  code: "POL-001",
  title: "Política de SST",
  kind: "policy",
  body: "La empresa se compromete con la seguridad y la salud de sus trabajadores.",
};

describe.skipIf(!hasTestDb)("gestión documental", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("ciclo completo: borrador, aprobación por otra persona, nueva versión y obsolescencia", async () => {
    const t = await mk();
    const id = await createDocument(t, "autor", "Autor", base);
    await expect(createDocument(t, "autor", "Autor", base)).rejects.toThrow("ese código");
    let [d] = await masterList(t);
    expect(d).toMatchObject({ review: "sin_aprobar", current: null });
    expect(await currentPolicy(t)).toBeNull();
    await expect(
      approveVersion(t, "autor", "Autor", d.draft!.id, sig, { effectiveFrom: "2026-01-01" }),
    ).rejects.toThrow("no puede aprobarlo");
    await expect(
      approveVersion(t, "dir", "Gerente", d.draft!.id, "x", { effectiveFrom: "2026-01-01" }),
    ).rejects.toThrow("firma");
    await approveVersion(t, "dir", "Gerente", d.draft!.id, sig, { effectiveFrom: "2026-01-01" });
    [d] = await masterList(t);
    expect(d.current).toMatchObject({ version: 1, status: "approved", nextReviewOn: "2027-01-01" });
    expect(d.current!.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
    expect((await currentPolicy(t))?.id).toBe(id);

    const nv = await saveDraft(t, "autor", "Autor", id, {
      body: "Texto actualizado de la política de SST de la empresa.",
      changeNote: "Ajuste anual",
    });
    expect(nv).toMatchObject({ version: 2, created: true });
    expect(
      (
        await saveDraft(t, "autor", "Autor", id, {
          body: "Otra edición del borrador de la política.",
        })
      ).created,
    ).toBe(false);
    [d] = await masterList(t);
    expect(d.current!.version).toBe(1); // sigue vigente la anterior hasta aprobar la nueva
    await approveVersion(t, "dir", "Gerente", d.draft!.id, sig, { effectiveFrom: "2026-06-01" });
    [d] = await masterList(t);
    expect(d.current!.version).toBe(2);
    expect(d.history.find((v) => v.version === 1)!.status).toBe("obsolete");
  });

  it("una versión aprobada es inmutable en la base de datos", async () => {
    const t = await mk();
    await createDocument(t, "autor", "Autor", base);
    const [d] = await masterList(t);
    await approveVersion(t, "dir", "Gerente", d.draft!.id, sig, { effectiveFrom: "2026-01-01" });
    await expect(
      withPlatform({ actorId: "x", action: "x", tenantId: t, audit: false }, (tx) =>
        tx
          .update(schema.documentVersion)
          .set({ body: "Contenido alterado a escondidas" })
          .where(eq(schema.documentVersion.id, d.draft!.id)),
      ),
    ).rejects.toThrow();
  });

  it("constancia de lectura: una por persona y solo de versiones vigentes", async () => {
    const t = await mk();
    await createDocument(t, "autor", "Autor", base);
    let [d] = await masterList(t);
    await expect(acknowledge(t, "w1", "Ana", d.draft!.id, null)).rejects.toBeInstanceOf(
      DocumentError,
    );
    await approveVersion(t, "dir", "Gerente", d.draft!.id, sig, { effectiveFrom: "2026-01-01" });
    [d] = await masterList(t);
    await acknowledge(t, "w1", "Ana", d.current!.id, "10.0.0.1");
    await acknowledge(t, "w1", "Ana", d.current!.id, "10.0.0.1");
    await acknowledge(t, "w2", "Luis", d.current!.id, null);
    expect((await acksFor(t, d.current!.id)).map((a) => a.userName)).toEqual(["Ana", "Luis"]);
  });
});
