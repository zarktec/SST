import { describe, expect, it } from "vitest";
import { NullDomains, VercelDomains } from "./index";

type Call = { url: string; method: string; body?: string };

function fakeVercel(routes: Record<string, { status: number; body: unknown }>) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body as string | undefined });
    const key = Object.keys(routes).find((k) => url.includes(k));
    const r = key ? routes[key] : { status: 404, body: {} };
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as unknown as typeof fetch;
  return { f, calls };
}

const cfg = { token: "tok", projectId: "prj_1", teamId: "team_1" };

describe("VercelDomains", () => {
  it("agrega el dominio al proyecto y devuelve instrucciones DNS cuando falta configurar", async () => {
    const { f, calls } = fakeVercel({
      "/v10/projects/prj_1/domains": { status: 200, body: { name: "sst.acme.com" } },
      "/v9/projects/prj_1/domains/": { status: 200, body: { verified: true } },
      "/v6/domains/": {
        status: 200,
        body: {
          misconfigured: true,
          recommendedCNAME: [
            { rank: 2, value: "cname.vercel-dns.com." },
            { rank: 1, value: "abc.vercel-dns-017.com." },
          ],
        },
      },
    });
    const s = await new VercelDomains(cfg, f).add("sst.acme.com");
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: expect.stringContaining("teamId=team_1"),
    });
    expect(JSON.parse(calls[0].body!)).toEqual({ name: "sst.acme.com" });
    expect(s).toMatchObject({ verified: true, configured: false });
    expect(s.instructions).toEqual([
      { type: "CNAME", name: "sst", value: "abc.vercel-dns-017.com" },
    ]);
  });

  it("dominio apex usa registro A; si Vercel pide TXT de verificación lo incluye", async () => {
    const { f } = fakeVercel({
      "/v10/projects/prj_1/domains": { status: 200, body: {} },
      "/v9/projects/prj_1/domains/": {
        status: 200,
        body: {
          verified: false,
          verification: [
            { type: "TXT", domain: "_vercel.acme.com", value: "vc-domain-verify=acme,123" },
          ],
        },
      },
      "/v6/domains/": {
        status: 200,
        body: {
          misconfigured: true,
          recommendedIPv4: [{ rank: 1, value: ["216.198.79.1", "64.29.17.1"] }],
        },
      },
    });
    const s = await new VercelDomains(cfg, f).add("acme.com");
    expect(s.verified).toBe(false);
    expect(s.instructions).toEqual([
      { type: "A", name: "@", value: "216.198.79.1" },
      { type: "TXT", name: "_vercel.acme.com", value: "vc-domain-verify=acme,123" },
    ]);
  });

  it("409 (ya agregado) es idempotente y configured=true cuando el DNS está bien", async () => {
    const { f } = fakeVercel({
      "/v10/projects/prj_1/domains": { status: 409, body: { error: { message: "exists" } } },
      "/v9/projects/prj_1/domains/": { status: 200, body: { verified: true } },
      "/v6/domains/": { status: 200, body: { misconfigured: false } },
    });
    expect(await new VercelDomains(cfg, f).add("acme.sst.zark.pro")).toMatchObject({
      verified: true,
      configured: true,
    });
  });

  it("propaga el error de Vercel (p. ej. dominio de otro proyecto)", async () => {
    const { f } = fakeVercel({
      "/v10/projects/prj_1/domains": {
        status: 403,
        body: { error: { message: "Domain is already in use by another project" } },
      },
    });
    const s = await new VercelDomains(cfg, f).add("x.com");
    expect(s).toMatchObject({
      verified: false,
      error: "Domain is already in use by another project",
    });
  });

  it("remove tolera 404 y falla en otros errores", async () => {
    const ok = fakeVercel({ "/v9/projects/prj_1/domains/": { status: 404, body: {} } });
    await expect(new VercelDomains(cfg, ok.f).remove("x.com")).resolves.toBeUndefined();
    const bad = fakeVercel({ "/v9/projects/prj_1/domains/": { status: 500, body: {} } });
    await expect(new VercelDomains(cfg, bad.f).remove("x.com")).rejects.toThrow();
  });

  it("el proveedor nulo da por verificado sin llamar a ninguna API", async () => {
    expect(await new NullDomains().add("a.sst.zark.pro")).toMatchObject({
      verified: true,
      configured: true,
    });
  });
});
