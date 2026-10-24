import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("emergencias: equipo, plan y simulacro con mejoras que crean acciones", async ({ page }) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(`${TENANT}/`);
  await page.goto(`${TENANT}/emergencias`);
  await page.waitForLoadState("load");
  await expect(page.getByText(/Aún no hay simulacros realizados/)).toBeVisible();

  await page.locator("summary", { hasText: "Agregar equipo" }).click();
  await page.locator("#na-code").fill("EXT-01");
  await page.locator("#na-location").fill("Pasillo principal");
  await page.locator("#na-expiresOn").fill("2020-01-01");
  await page.getByRole("button", { name: "Agregar equipo" }).click();
  await expect(page.getByText("Extintor EXT-01")).toBeVisible();
  await expect(page.getByText(/Vencido/).first()).toBeVisible();

  await page.locator("summary", { hasText: "Crear o actualizar un plan" }).click();
  await page.locator("#pl-vulnerabilityAnalysis").fill("Edificio de dos pisos con una sola salida");
  await page.getByRole("button", { name: "Guardar plan" }).click();
  await expect(page.getByText("Edificio de dos pisos con una sola salida")).toBeVisible();

  await page.locator("#nd-scenario").fill("Evacuación por incendio");
  await page.getByRole("button", { name: "Programar", exact: true }).click();
  await page.locator("summary", { hasText: "Registrar resultado" }).click();
  await page.locator('[id^="dr-"][id$="-evaluation"]').fill("Evacuación completa en cinco minutos");
  await page.locator('[id^="dr-"][id$="-improvements"]').fill("Señalizar la ruta de evacuación B");
  await page.getByRole("button", { name: "Registrar simulacro" }).click();
  await expect(page.getByText("Realizado")).toBeVisible();
  await expect(page.getByText(/Aún no hay simulacros realizados/)).toHaveCount(0);

  await page.goto(`${TENANT}/acciones`);
  await expect(page.getByText(/Simulacro: Señalizar la ruta/)).toBeVisible();
});
