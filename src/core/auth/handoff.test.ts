import { afterAll, describe, expect, it } from "vitest";
import { closeDb } from "@/core/db";
import { hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { consumeHandoff, HANDOFF_TTL_MS, issueHandoff, sanitizeNext } from "./handoff";

pointToTestDb();

describe("sanitizeNext (anti open-redirect)", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/a?b=1", "/a?b=1"],
    ["//evil.com", "/"],
    ["/\\evil.com", "/"],
    ["https://evil.com", "/"],
    ["javascript:alert(1)", "/"],
    ["/ok\r\nSet-Cookie: x=1", "/"],
    ["", "/"],
    [null, "/"],
  ])("%s → %s", (input, out) => {
    expect(sanitizeNext(input as string | null)).toBe(out);
  });
});

describe.skipIf(!hasTestDb)("handoff de sesión", () => {
  afterAll(closeDb);
  const base = {
    userId: "u1",
    tenantId: "0190a000-0000-7000-8000-000000000001",
    loginMethod: "google",
  };

  it("se puede consumir una sola vez", async () => {
    const t = await issueHandoff({ ...base, host: "acme.sst.zark.pro", next: "/inicio" });
    const first = await consumeHandoff(t, "acme.sst.zark.pro");
    expect(first).toMatchObject({ userId: "u1", next: "/inicio", loginMethod: "google" });
    expect(await consumeHandoff(t, "acme.sst.zark.pro")).toBeNull();
  });

  it("solo sirve en el host para el que se emitió (y se quema al fallar)", async () => {
    const t = await issueHandoff({ ...base, host: "acme.sst.zark.pro" });
    expect(await consumeHandoff(t, "otra.sst.zark.pro")).toBeNull();
    expect(await consumeHandoff(t, "acme.sst.zark.pro")).toBeNull();
  });

  it("vence a los 60 segundos", async () => {
    const now = new Date();
    const t = await issueHandoff({ ...base, host: "acme.sst.zark.pro" }, now);
    expect(
      await consumeHandoff(t, "acme.sst.zark.pro", new Date(now.getTime() + HANDOFF_TTL_MS + 1000)),
    ).toBeNull();
  });

  it("rechaza tokens inventados y sanea el destino", async () => {
    expect(await consumeHandoff("inventado", "acme.sst.zark.pro")).toBeNull();
    const t = await issueHandoff({ ...base, host: "acme.sst.zark.pro", next: "//evil.com" });
    expect((await consumeHandoff(t, "acme.sst.zark.pro"))?.next).toBe("/");
  });
});
