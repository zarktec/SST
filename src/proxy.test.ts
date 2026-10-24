import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const tenants: Record<string, { tenantId: string; slug: string }> = {
  acme: { tenantId: "t-acme", slug: "acme" },
};
vi.mock("@/core/tenancy/resolve", () => ({
  resolveTenantBySlug: async (s: string) => tenants[s] ?? null,
  resolveTenantByHost: async (h: string) =>
    h === "sst.acme.co" ? { tenantId: "t-acme", slug: "acme" } : null,
}));

import { proxy } from "./proxy";

const ROOT = "sst.zark.pro";
beforeEach(() => {
  process.env.NEXT_PUBLIC_ROOT_DOMAIN = ROOT;
});

const call = (host: string, path: string, headers: Record<string, string> = {}) =>
  proxy(new NextRequest(`https://${host}${path}`, { headers: { host, ...headers } }));
/** Destino interno de la reescritura y encabezados que recibirá la app. */
const rewritten = (res: Response) => ({
  to: res.headers.get("x-middleware-rewrite")
    ? new URL(res.headers.get("x-middleware-rewrite")!).pathname
    : null,
  next: res.headers.get("x-middleware-next") === "1",
  tenant: res.headers.get("x-middleware-request-x-tenant-id"),
  base: res.headers.get("x-middleware-request-x-tenant-base"),
});

describe("proxy: empresa por ruta en el dominio raíz", () => {
  it("/{slug}/… llega al área de la empresa con su id y base", async () => {
    expect(rewritten(await call(ROOT, "/acme/personas"))).toMatchObject({
      to: "/tenant/personas",
      tenant: "t-acme",
      base: "/acme",
    });
    expect(rewritten(await call(ROOT, "/acme"))).toMatchObject({ to: "/tenant", base: "/acme" });
    expect(rewritten(await call(ROOT, "/acme/login"))).toMatchObject({ to: "/tenant/login" });
  });
  it("/{slug}/api/… llega a la API común con la empresa", async () => {
    expect(rewritten(await call(ROOT, "/acme/api/inspecciones/sync"))).toMatchObject({
      to: "/api/inspecciones/sync",
      tenant: "t-acme",
      base: "/acme",
    });
  });
  it("las rutas de marketing no se confunden con empresas", async () => {
    expect(rewritten(await call(ROOT, "/precios")).to).toBe("/site/precios");
    expect(rewritten(await call(ROOT, "/registro")).to).toBe("/site/registro");
    expect(rewritten(await call(ROOT, "/")).to).toBe("/site");
    expect(rewritten(await call(ROOT, "/api/auth/get-session")).next).toBe(true);
  });
  it("un slug que no existe cae en marketing (404 de Next), sin encabezados de empresa", async () => {
    expect(rewritten(await call(ROOT, "/no-existe/personas"))).toMatchObject({
      to: "/site/no-existe/personas",
      tenant: null,
    });
  });
});

describe("proxy: dominio propio, admin, auth y desconocidos", () => {
  it("dominio propio verificado: panel en la raíz, base vacía", async () => {
    expect(rewritten(await call("sst.acme.co", "/personas"))).toMatchObject({
      to: "/tenant/personas",
      tenant: "t-acme",
      base: "",
    });
    expect(rewritten(await call("sst.acme.co", "/"))).toMatchObject({ to: "/tenant" });
    expect(rewritten(await call("sst.acme.co", "/api/inspecciones/sync"))).toMatchObject({
      to: "/api/inspecciones/sync",
      tenant: "t-acme",
    });
  });
  it("dominio propio no verificado: 404", async () => {
    expect((await call("otro.com", "/")).status).toBe(404);
  });
  it("admin y auth conservan su área", async () => {
    expect(rewritten(await call(`admin.${ROOT}`, "/login")).to).toBe("/platform/login");
    expect(rewritten(await call(`auth.${ROOT}`, "/login")).to).toBe("/central/login");
  });
  it("subdominios de empresa (ya no existen) y carpetas internas: 404", async () => {
    expect((await call(`acme.${ROOT}`, "/")).status).toBe(404);
    expect((await call(ROOT, "/tenant/personas")).status).toBe(404);
    expect((await call(`admin.${ROOT}`, "/platform")).status).toBe(404);
  });
});

describe("proxy: seguridad de los encabezados de empresa", () => {
  it("borra los x-tenant-* enviados por el cliente", async () => {
    const spoof = { "x-tenant-id": "t-victima", "x-tenant-base": "/victima" };
    for (const [host, path] of [
      [ROOT, "/precios"],
      [ROOT, "/api/auth/get-session"],
      [`admin.${ROOT}`, "/login"],
      [`auth.${ROOT}`, "/login"],
    ] as const) {
      const res = await call(host, path, spoof);
      const r = rewritten(res);
      expect(r.tenant).toBeNull();
      expect(r.base).toBeNull();
      // Next solo reenvía a la app los encabezados listados aquí: los del cliente ya no están.
      const kept = (res.headers.get("x-middleware-override-headers") ?? "").split(",");
      expect(kept).toContain("host");
      expect(kept).not.toContain("x-tenant-id");
      expect(kept).not.toContain("x-tenant-base");
    }
    // En una empresa real se sobrescriben con los valores del proxy
    expect(rewritten(await call(ROOT, "/acme/personas", spoof))).toMatchObject({
      tenant: "t-acme",
      base: "/acme",
    });
  });
});
