import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeDb } from "@/core/db";
import { hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { GET } from "./route";

pointToTestDb();

describe("cron diario: autenticación", () => {
  beforeAll(() => {
    process.env.CRON_SECRET = "secreto-de-prueba";
  });
  afterAll(closeDb);

  it("rechaza sin encabezado o con secreto incorrecto", async () => {
    expect((await GET(new Request("http://x/api/cron/daily"))).status).toBe(401);
    expect(
      (
        await GET(
          new Request("http://x/api/cron/daily", { headers: { authorization: "Bearer otro" } }),
        )
      ).status,
    ).toBe(401);
  });
  it("rechaza todo si CRON_SECRET no está configurado", async () => {
    delete process.env.CRON_SECRET;
    expect(
      (
        await GET(
          new Request("http://x/api/cron/daily", {
            headers: { authorization: "Bearer undefined" },
          }),
        )
      ).status,
    ).toBe(401);
    process.env.CRON_SECRET = "secreto-de-prueba";
  });
  it.skipIf(!hasTestDb)(
    "con el secreto correcto ejecuta el barrido y responde el resumen",
    async () => {
      const res = await GET(
        new Request("http://x/api/cron/daily", {
          headers: { authorization: "Bearer secreto-de-prueba" },
        }),
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        ok: true,
        sweep: { evaluated: expect.any(Number) },
      });
    },
  );
});
