import { describe, expect, it } from "vitest";
import {
  ZARK_BRAND,
  brandCssVars,
  brandStyleSheet,
  checkBrand,
  contrastRatio,
  readableOn,
  suggestAccessible,
} from "./contrast";

describe("contraste WCAG", () => {
  it("calcula razones conocidas", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 1); // límite AA clásico
  });
  it("elige texto blanco u oscuro según el fondo", () => {
    expect(readableOn("#0f766e")).toBe("#ffffff");
    expect(readableOn("#fde047")).toBe("#111111");
  });
  it("sugiere un color accesible que conserva el tono y cumple AA", () => {
    const s = suggestAccessible("#f59e0b", "#ffffff");
    expect(contrastRatio(s, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(s).not.toBe("#f59e0b");
    expect(suggestAccessible("#0f766e", "#ffffff")).toBe("#0f766e");
  });
  it("en fondo oscuro aclara el color", () => {
    const s = suggestAccessible("#1e293b", "#0a0a0a");
    expect(contrastRatio(s, "#0a0a0a")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("checkBrand", () => {
  it("marca la paleta que no cumple y propone ajuste", () => {
    const checks = checkBrand({ primary: "#f59e0b", secondary: "#1e293b", accent: "#fde047" });
    const asText = checks.find((c) => c.key === "primary.onLight")!;
    expect(asText.passesAA).toBe(false);
    expect(contrastRatio(asText.suggestion!, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    // Con texto automático (blanco/oscuro) los botones siempre pasan AA para estos colores
    expect(checks.filter((c) => c.key.endsWith(".button")).every((c) => c.passesAA)).toBe(true);
  });
  it("una paleta sana pasa todo", () => {
    expect(
      checkBrand({ primary: "#0f766e", secondary: "#1e293b", accent: "#b45309" }).every(
        (c) => c.passesAA,
      ),
    ).toBe(true);
  });
});

describe("variables CSS", () => {
  it("genera tema claro y oscuro con texto de marca accesible", () => {
    const { light, dark } = brandCssVars({
      primary: "#0f766e",
      secondary: "#1e293b",
      accent: "#f59e0b",
    });
    expect(light["--primary"]).toBe("#0f766e");
    expect(contrastRatio(light["--brand-text"], "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(dark["--brand-text"], "#0a0a0a")).toBeGreaterThanOrEqual(4.5);
  });
  it("la paleta de ZarK cumple AA en claro; en oscuro se conserva la paleta de siempre", () => {
    expect(ZARK_BRAND).toEqual({ primary: "#001953", secondary: "#001953", accent: "#ff5800" });
    const { light, dark } = brandCssVars(ZARK_BRAND);
    // Botón azul con texto blanco; ítem activo del menú: texto blanco sobre el acento (oscurecido lo mínimo).
    expect(contrastRatio(light["--primary"], light["--primary-foreground"])).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(light["--nav-active-fg"]).toBe("#ffffff");
    expect(contrastRatio(light["--nav-active-bg"], "#ffffff")).toBeGreaterThanOrEqual(4.5);
    // Tema oscuro: como antes de la identidad ZarK (verde azulado y pizarra), no el azul/naranja.
    expect(dark["--primary"]).toBe("#0f766e");
    expect(dark["--secondary"]).toBe("#1e293b");
    expect(dark["--nav-active-bg"]).toBe("#0f766e");
  });
  it("una empresa con marca propia la usa también en oscuro", () => {
    const { dark } = brandCssVars({ primary: "#7c3aed", secondary: "#111827", accent: "#f59e0b" });
    expect(dark["--primary"]).toBe("#7c3aed");
  });
  it("rechaza colores inválidos (no se inyecta CSS arbitrario)", () => {
    expect(() =>
      brandStyleSheet({
        primary: "red;}body{display:none",
        secondary: "#000000",
        accent: "#000000",
      }),
    ).toThrow();
  });
});
