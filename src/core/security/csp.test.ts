import { describe, expect, it } from "vitest";
import { buildCsp, newNonce } from "./csp";

describe("CSP", () => {
  it("scripts solo con nonce y strict-dynamic; sin unsafe-inline ni unsafe-eval en producción", () => {
    const csp = buildCsp({ nonce: "abc" });
    const script = csp.split("; ").find((d) => d.startsWith("script-src"))!;
    expect(script).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(script).not.toMatch(/unsafe/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
  });
  it("permite la tokenización de Wompi y no otros orígenes de conexión", () => {
    const connect = buildCsp({ nonce: "x" })
      .split("; ")
      .find((d) => d.startsWith("connect-src"))!;
    expect(connect).toBe("connect-src 'self' https://production.wompi.co https://sandbox.wompi.co");
  });
  it("en desarrollo permite eval y websockets; sin https no fuerza la mejora a https", () => {
    const dev = buildCsp({ nonce: "x", dev: true, https: false });
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).toContain("ws:");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });
  it("el nonce es aleatorio y distinto en cada solicitud", () => {
    const a = newNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(newNonce()).not.toBe(a);
  });
});
