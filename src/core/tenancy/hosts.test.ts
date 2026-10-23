import { describe, expect, it } from "vitest";
import { classifyHost, isValidSlug, originFor } from "./hosts";

const root = "sst.zark.pro";

describe("classifyHost", () => {
  it("reconoce marketing, admin y auth", () => {
    expect(classifyHost("sst.zark.pro", root)).toEqual({ kind: "marketing" });
    expect(classifyHost("www.sst.zark.pro", root)).toEqual({ kind: "marketing" });
    expect(classifyHost("admin.sst.zark.pro", root)).toEqual({ kind: "admin" });
    expect(classifyHost("auth.sst.zark.pro", root)).toEqual({ kind: "auth" });
  });
  it("reconoce subdominios de empresa", () => {
    expect(classifyHost("Acme.sst.zark.pro", root)).toEqual({ kind: "subdomain", slug: "acme" });
  });
  it("no trata como tenant los niveles anidados ni los slugs reservados", () => {
    expect(classifyHost("a.b.sst.zark.pro", root)).toEqual({ kind: "marketing" });
    expect(classifyHost("api.sst.zark.pro", root)).toEqual({ kind: "marketing" });
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

describe("helpers", () => {
  it("usa http solo en local", () => {
    expect(originFor("acme.lvh.me:3000")).toBe("http://acme.lvh.me:3000");
    expect(originFor("acme.sst.zark.pro")).toBe("https://acme.sst.zark.pro");
  });
  it("valida slugs", () => {
    expect(isValidSlug("acme-sas")).toBe(true);
    expect(isValidSlug("admin")).toBe(false);
    expect(isValidSlug("-x")).toBe(false);
    expect(isValidSlug("a")).toBe(false);
  });
});
