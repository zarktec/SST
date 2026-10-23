import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import {
  createDraft,
  importItems,
  publishVersion,
  seedCatalogs,
} from "@/modules/platform/catalogs/service";
import { getMatrix, saveEntry, unevaluatedCount } from "./service";

pointToTestDb();
let n = 0;
const mk = () => createTenantWithSubscription(`lg-${++n}`).then((t) => t.id);

describe.skipIf(!hasTestDb)("matriz legal de la empresa", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
    const d = await createDraft("legal_requirements", "t");
    const r = await importItems(
      d.id,
      [
        {
          normCode: "ley-1562-2012",
          article: "2",
          requirement: "Afiliar a los trabajadores al SGRL",
          appliesTo: ["todas"],
          periodicity: "Permanente",
        },
      ],
      { strict: true },
    );
    expect(r.errors).toEqual([]);
    await publishVersion(d.id, { effectiveFrom: "2019-01-01", sourceNorm: "test", notes: "" }, "t");
  });

  it("todo lo de la base arranca sin evaluar; las normas traen sus requisitos", async () => {
    const t = await mk();
    const m = await getMatrix(t);
    expect(m.lines.length).toBeGreaterThan(5);
    expect(m.summary.unevaluated).toBe(m.lines.length);
    expect(m.lines.find((l) => l.kind === "requirement")?.normCode).toBe("ley-1562-2012");
    expect(await unevaluatedCount(t)).toBe(m.lines.length);
  });

  it("guarda la evaluación de una norma y de un requisito; actualiza (upsert)", async () => {
    const t = await mk();
    await saveEntry(t, "u", {
      kind: "norm",
      code: "ley-1562-2012",
      applies: "yes",
      compliance: "cumple",
      evidence: "Certificado ARL",
    });
    await saveEntry(t, "u", {
      kind: "requirement",
      code: "ley-1562-2012#2",
      applies: "no",
      justification: "No aplica a la actividad",
    });
    let m = await getMatrix(t);
    expect(m.summary).toMatchObject({ cumple: 1, notApplicable: 1 });
    await saveEntry(t, "u", {
      kind: "norm",
      code: "ley-1562-2012",
      applies: "yes",
      compliance: "parcial",
      evidence: "En proceso",
    });
    m = await getMatrix(t);
    expect(m.summary).toMatchObject({ cumple: 0, parcial: 1 });
  });

  it("rechaza elementos fuera de la base, validaciones y aísla por empresa", async () => {
    const a = await mk();
    const b = await mk();
    await expect(
      saveEntry(a, "u", { kind: "norm", code: "ley-9999-2099", applies: "yes" }),
    ).rejects.toThrow(/base vigente/);
    await expect(
      saveEntry(a, "u", { kind: "norm", code: "ley-1562-2012", applies: "no" }),
    ).rejects.toThrow();
    await saveEntry(a, "u", {
      kind: "norm",
      code: "ley-1562-2012",
      applies: "yes",
      compliance: "no_cumple",
    });
    expect((await getMatrix(b)).summary.noCumple).toBe(0);
    expect((await getMatrix(a)).summary.noCumple).toBe(1);
  });
});
