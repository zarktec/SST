import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { ADMIN, TENANT, loginAdminWith2fa, resetState } from "./helpers";

test.beforeEach(resetState);

async function login(page: import("@playwright/test").Page) {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
}

test("centro de ayuda: índice, búsqueda, guía y ayuda contextual", async ({ page }) => {
  await login(page);
  await page.goto(`${TENANT}/ayuda`);
  await expect(page.getByRole("heading", { name: "Centro de ayuda" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Primeros pasos/ })).toBeVisible();

  // Búsqueda sin tildes ni mayúsculas
  await page.getByLabel("Buscar en la ayuda").fill("AUTORIZACION de datos");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByText(/resultado/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Privacidad y datos personales/ })).toBeVisible();
  await page.getByLabel("Buscar en la ayuda").fill("zzzzqq");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByText(/Sin resultados/)).toBeVisible();

  // Guía de un módulo, con el botón para abrir la pantalla
  await page.goto(`${TENANT}/ayuda/personas`);
  await expect(page.getByRole("heading", { name: /Personas \(trabajadores/ })).toBeVisible();
  await expect(page.getByText("Carga masiva con un archivo CSV")).toBeVisible();
  await page.getByRole("link", { name: "Abrir esta pantalla" }).click();
  await expect(page).toHaveURL(`${TENANT}/personas`);

  // Ayuda contextual: el «?» de la barra superior lleva a la guía del módulo actual
  await page.getByRole("link", { name: "Ayuda sobre esta pantalla" }).click();
  await expect(page).toHaveURL(`${TENANT}/ayuda/personas`);

  // Una guía que no existe
  const res = await page.goto(`${TENANT}/ayuda/no-existe`);
  expect(res?.status()).toBe(404);
});

test("centro de ayuda sin violaciones de accesibilidad", async ({ page }) => {
  await login(page);
  for (const path of ["/ayuda", "/ayuda/accidentes", "/ayuda/glosario"]) {
    await page.goto(`${TENANT}${path}`);
    await page.waitForLoadState("networkidle");
    const r = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(r.violations.map((v) => `${path} ${v.id}: ${v.nodes[0]?.target.join(" ")}`)).toEqual([]);
  }
});

test("ayuda del panel de administración", async ({ page }) => {
  await loginAdminWith2fa(page);
  await page.goto(`${ADMIN}/ayuda`);
  await expect(page.getByRole("heading", { name: "Centro de ayuda" })).toBeVisible();
  await page.getByRole("link", { name: /Empresas y suscripciones/ }).click();
  await expect(page.getByText("Conceder meses gratis").first()).toBeVisible();
  await page.goto(`${ADMIN}/empresas`);
  await page.getByRole("link", { name: "Ayuda sobre esta pantalla" }).click();
  await expect(page).toHaveURL(`${ADMIN}/ayuda/empresas`);
});
