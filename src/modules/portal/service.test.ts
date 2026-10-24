import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import {
  acknowledge,
  approveVersion,
  createDocument,
  masterList,
} from "@/modules/documents/service";
import { seedCatalogs } from "@/modules/platform/catalogs/service";
import { createReport } from "@/modules/unsafe-reports/service";
import { createWorker } from "@/modules/workers/service";
import { portalFor } from "./service";

pointToTestDb();
const sig = `data:image/png;base64,${Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(400, 7)]).toString("base64")}`;
let n = 0;
const mk = () => createTenantWithSubscription(`po-${++n}`).then((t) => t.id);

describe.skipIf(!hasTestDb)("portal del trabajador", () => {
  afterAll(closeDb);
  beforeAll(async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    await seedCatalogs();
  });

  it("vincula al usuario con su ficha por correo y solo muestra datos propios", async () => {
    const t = await mk();
    const mkw = (name: string, email: string, i: number) =>
      createWorker(t, "u", {
        kind: "employee",
        idType: "13",
        idNumber: `${6000000 + n * 10 + i}`,
        fullName: name,
        email,
        startDate: "2024-01-01",
        position: "Operario",
      });
    await mkw("Ana Pérez", "Ana@Demo.Test", 1);
    await mkw("Luis Gómez", "luis@demo.test", 2);
    const a = await portalFor(t, { id: "ua", email: "ana@demo.test" });
    expect(a.worker?.name).toBe("Ana Pérez");
    const l = await portalFor(t, { id: "ul", email: "luis@demo.test" });
    expect(l.worker?.name).toBe("Luis Gómez");
    expect((await portalFor(t, { id: "ux", email: "otra@demo.test" })).worker).toBeNull();
  });

  it("política vigente con constancia de lectura y reportes propios (no los anónimos ni los de otros)", async () => {
    const t = await mk();
    await createDocument(t, "autor", "Autor", {
      code: "POL-001",
      title: "Política de SST",
      kind: "policy",
      body: "La empresa se compromete con la seguridad y la salud.",
    });
    const [d] = await masterList(t);
    await approveVersion(t, "dir", "Gerente", d.draft!.id, sig, { effectiveFrom: "2026-01-01" });
    let p = await portalFor(t, { id: "ua", email: "ana@demo.test" });
    expect(p.policy?.code).toBe("POL-001");
    expect(p.policyAcked).toBe(false);
    await acknowledge(t, "ua", "Ana", p.policy!.current!.id, null);
    p = await portalFor(t, { id: "ua", email: "ana@demo.test" });
    expect(p.policyAcked).toBe(true);

    await createReport(t, "ua", { kind: "condition", description: "Piso mojado en el pasillo" });
    await createReport(t, "ua", {
      kind: "condition",
      description: "Reporte anónimo de Ana",
      anonymous: true,
    });
    await createReport(t, "ub", { kind: "act", description: "Reporte de otra persona" });
    expect(
      (await portalFor(t, { id: "ua", email: "ana@demo.test" })).reports.map((r) => r.description),
    ).toEqual(["Piso mojado en el pasillo"]);
  });
});
