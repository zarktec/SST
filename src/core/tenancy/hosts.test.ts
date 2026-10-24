import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  RESERVED_SLUGS,
  classifyHost,
  isValidSlug,
  originFor,
  stripBase,
  tenantSlugFromPath,
  withBase,
} from "./hosts";

const root = "sst.zark.pro";

describe("classifyHost", () => {
  it("reconoce marketing, admin y auth", () => {
    expect(classifyHost("sst.zark.pro", root)).toEqual({ kind: "marketing" });
    expect(classifyHost("www.sst.zark.pro", root)).toEqual({ kind: "marketing" });
    expect(classifyHost("admin.sst.zark.pro", root)).toEqual({ kind: "admin" });
    expect(classifyHost("auth.sst.zark.pro", root)).toEqual({ kind: "auth" });
  });
  it("las empresas ya no usan subdominio: cualquier otro *.root es desconocido", () => {
    expect(classifyHost("Acme.sst.zark.pro", root)).toEqual({ kind: "unknown" });
    expect(classifyHost("a.b.sst.zark.pro", root)).toEqual({ kind: "unknown" });
    expect(classifyHost("api.sst.zark.pro", root)).toEqual({ kind: "unknown" });
  });
  it("trata cualquier otro host como dominio propio", () => {
    expect(classifyHost("sst.miempresa.com", root)).toEqual({
      kind: "custom",
      host: "sst.miempresa.com",
    });
    // Intento de suplantación: contiene el root pero no termina en él
    expect(classifyHost("sst.zark.pro.evil.com", root)).toEqual({
      kind: "custom",
      host: "sst.zark.pro.evil.com",
    });
  });
});

describe("empresa por ruta", () => {
  it("toma el primer segmento como posible slug", () => {
    expect(tenantSlugFromPath("/acme")).toBe("acme");
    expect(tenantSlugFromPath("/Acme-SAS/personas/1")).toBe("acme-sas");
    expect(tenantSlugFromPath("/")).toBeNull();
  });
  it("no toma rutas de marketing ni reservadas", () => {
    for (const p of ["/precios", "/registro", "/login", "/api/x", "/offline", "/_next/x", "/-x"])
      expect(tenantSlugFromPath(p)).toBeNull();
  });
  it("todas las carpetas de src/app/site están reservadas (no pueden ser slug de empresa)", () => {
    const dir = path.join(process.cwd(), "src/app/site");
    const routes = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    expect(routes.length).toBeGreaterThan(0);
    for (const r of routes) expect(RESERVED_SLUGS.has(r), `falta reservar "${r}"`).toBe(true);
  });
  it("antepone y quita la base de la empresa", () => {
    expect(withBase("/acme", "/personas")).toBe("/acme/personas");
    expect(withBase("/acme", "/")).toBe("/acme");
    expect(withBase("/acme", "/personas?x=1")).toBe("/acme/personas?x=1");
    expect(withBase("", "/personas")).toBe("/personas");
    // No toca URLs externas ni protocolo-relativas
    expect(withBase("/acme", "//evil.com")).toBe("//evil.com");
    expect(withBase("/acme", "https://x.co/a")).toBe("https://x.co/a");
    expect(stripBase("/acme", "/acme")).toBe("/");
    expect(stripBase("/acme", "/acme/personas")).toBe("/personas");
    expect(stripBase("/acme", "/acmeX")).toBe("/acmeX");
    expect(stripBase("", "/personas")).toBe("/personas");
  });
});

describe("helpers", () => {
  it("usa http solo en local", () => {
    expect(originFor("acme.lvh.me:3000")).toBe("http://acme.lvh.me:3000");
    expect(originFor("localhost:3000")).toBe("http://localhost:3000");
    expect(originFor("sst.zark.pro")).toBe("https://sst.zark.pro");
  });
  it("valida slugs", () => {
    expect(isValidSlug("acme-sas")).toBe(true);
    expect(isValidSlug("admin")).toBe(false);
    expect(isValidSlug("precios")).toBe(false);
    expect(isValidSlug("-x")).toBe(false);
    expect(isValidSlug("a")).toBe(false);
  });
});
