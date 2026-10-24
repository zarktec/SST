import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { ADMIN, TENANT, resetState } from "./helpers";

/**
 * Accesibilidad WCAG 2.1 AA (axe-core) en las pantallas principales, en escritorio y a 375 px, más objetivos táctiles de 44 px
 * en botones y campos (móvil). La landing y el registro corren sin sesión; el resto con la empresa demo.
 */
test.beforeEach(resetState);

const PUBLIC = [
  `http://localhost:3000/`,
  `http://localhost:3000/precios`,
  `http://localhost:3000/registro`,
  `${TENANT}/login`,
  `${ADMIN}/login`,
];
const APP = [
  "/",
  "/estandares",
  "/personas",
  "/capacitacion",
  "/epp",
  "/comites",
  "/medicina",
  "/emergencias",
  "/alto-riesgo",
  "/quimicos",
  "/pesv",
  "/vigilancia",
  "/vigilancia/psicosocial",
  "/auditorias",
  "/revision-direccion",
  "/acciones",
  "/accidentes",
  "/reportes",
  "/inspecciones",
  "/indicadores",
  "/documentos",
  "/informes",
  "/notificaciones",
  "/calendario",
  "/portal",
  "/privacidad",
  "/buscar?q=ab",
  "/facturacion",
];

async function audit(page: Page, url: string) {
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return r.violations.map(
    (v) => `${v.id} (${v.impact}) ×${v.nodes.length}: ${v.nodes[0]?.target.join(" ")} — ${v.help}`,
  );
}

test("páginas públicas sin violaciones WCAG 2.1 AA", async ({ page }) => {
  const out: string[] = [];
  for (const url of PUBLIC) for (const v of await audit(page, url)) out.push(`${url} → ${v}`);
  expect(out).toEqual([]);
});

test("pantallas de la empresa sin violaciones WCAG 2.1 AA", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
  const out: string[] = [];
  for (const path of APP)
    for (const v of await audit(page, `${TENANT}${path}`)) out.push(`${path} → ${v}`);
  expect(out).toEqual([]);
});

test("botones y campos cumplen el objetivo táctil de 44 px (móvil)", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile-375", "solo aplica al viewport móvil");
  test.setTimeout(240_000);
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
  const small: string[] = [];
  for (const path of [
    "/",
    "/acciones",
    "/emergencias",
    "/documentos",
    "/informes",
    "/portal",
    "/privacidad",
    "/inspecciones",
  ]) {
    await page.goto(`${TENANT}${path}`);
    await page.waitForLoadState("networkidle");
    const found = await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          "button, select, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), textarea, summary",
        ),
      ]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
        })
        .filter((el) => el.getBoundingClientRect().height < 43.5)
        .map(
          (el) =>
            `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} "${(el.textContent || (el as HTMLInputElement).placeholder || "").trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().height)}px`,
        ),
    );
    for (const f of found) small.push(`${path}: ${f}`);
  }
  expect(small).toEqual([]);
});

test("navegación con teclado: el primer Tab ofrece saltar al contenido y el foco es visible", async ({
  page,
}) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Saltar al contenido" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#contenido")).toBeFocused();
  // Todo control enfocable muestra un indicador de foco (outline o ring) al recibir el foco por teclado.
  await page.goto(`${TENANT}/acciones`);
  await page.waitForLoadState("networkidle");
  const lost = await page.evaluate(async () => {
    const out: string[] = [];
    const els = [
      ...document.querySelectorAll<HTMLElement>(
        "main a[href], main button, main input:not([type=hidden]), main select, main textarea",
      ),
    ].slice(0, 25);
    for (const el of els) {
      el.focus();
      const cs = getComputedStyle(el);
      const ring =
        cs.boxShadow !== "none" || (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0);
      if (!ring) out.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}`);
    }
    return out;
  });
  expect(lost).toEqual([]);
});
