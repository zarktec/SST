import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MODULE_GROUPS } from "@/components/layout/nav-config";
import { PERMISSION_MODULES } from "@/core/rbac/roles";
import { PLATFORM_ARTICLES, PLATFORM_GROUPS, TENANT_ARTICLES, TENANT_GROUPS } from "./content";
import { normalize, routeMap, searchArticles, textOf, type Article } from "./types";

const root = process.cwd();

function checkSet(name: string, articles: Article[], groups: string[], appDir: string) {
  describe(`ayuda: ${name}`, () => {
    it("los slugs son únicos y cada artículo está en un grupo del índice", () => {
      const slugs = articles.map((a) => a.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const a of articles) expect(groups, a.slug).toContain(a.group);
    });
    it("los artículos relacionados existen y no se apuntan a sí mismos", () => {
      for (const a of articles)
        for (const r of a.related ?? []) {
          expect(
            articles.some((x) => x.slug === r),
            `${a.slug} → ${r}`,
          ).toBe(true);
          expect(r).not.toBe(a.slug);
        }
    });
    it("las rutas apuntan a pantallas que existen", () => {
      for (const a of articles) {
        if (!a.route || a.route === "/") continue;
        expect(existsSync(join(root, appDir, a.route, "page.tsx")), `${a.slug}: ${a.route}`).toBe(
          true,
        );
      }
    });
    it("todos tienen resumen y contenido", () => {
      for (const a of articles) {
        expect(a.summary.length, a.slug).toBeGreaterThan(20);
        expect(a.blocks.length, a.slug).toBeGreaterThan(0);
      }
    });
  });
}

checkSet("empresas", TENANT_ARTICLES, TENANT_GROUPS, "src/app/tenant/(app)");
checkSet("plataforma", PLATFORM_ARTICLES, PLATFORM_GROUPS, "src/app/platform/(app)");

describe("ayuda: cobertura", () => {
  it("cada pantalla del menú de la empresa tiene su guía", () => {
    const routes = new Set(TENANT_ARTICLES.map((a) => a.route));
    for (const g of MODULE_GROUPS)
      for (const i of g.items) expect(routes.has(i.href), `sin guía: ${i.href}`).toBe(true);
  });
  it("los módulos de permisos de las guías son válidos", () => {
    for (const a of TENANT_ARTICLES)
      if (a.module) expect(PERMISSION_MODULES as readonly string[], a.slug).toContain(a.module);
  });
  it("la ayuda contextual encuentra la guía de cada módulo", () => {
    const m = routeMap(TENANT_ARTICLES);
    expect(m.personas).toBe("personas");
    expect(m.accidentes).toBe("accidentes");
    expect(m.vigilancia).toBe("vigilancia");
  });
});

describe("ayuda: búsqueda", () => {
  it("ignora tildes y mayúsculas y exige todas las palabras", () => {
    expect(normalize("Autorización")).toBe("autorizacion");
    expect(searchArticles(TENANT_ARTICLES, "ACCIDENTE arl").map((a) => a.slug)).toContain(
      "accidentes",
    );
    expect(searchArticles(TENANT_ARTICLES, "zzzzqq")).toEqual([]);
    expect(searchArticles(TENANT_ARTICLES, "")).toHaveLength(TENANT_ARTICLES.length);
  });
  it("el título pesa más que el cuerpo al ordenar", () => {
    expect(searchArticles(TENANT_ARTICLES, "firma")[0].slug).toBe("firmas");
  });
  it("el texto buscable incluye los pasos", () => {
    const a = TENANT_ARTICLES.find((x) => x.slug === "personas")!;
    expect(normalize(textOf(a))).toContain("carga masiva");
  });
});
