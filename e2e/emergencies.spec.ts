import { expect, test } from "@playwright/test";
import { TENANT, openModal, resetState } from "./helpers";

test.beforeEach(resetState);

test("emergencias: equipo, plan y simulacro con mejoras que crean acciones", async ({ page }) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
  await page.goto(`${TENANT}/emergencias`);
  await page.waitForLoadState("load");
  await expect(page.getByText(/Aún no hay simulacros realizados/)).toBeVisible();

  let dlg = await openModal(page, "Agregar equipo");
  await dlg.locator("#na-code").fill("EXT-01");
  await dlg.locator("#na-location").fill("Pasillo principal");
  await dlg.locator("#na-expiresOn").fill("2020-01-01");
  await dlg.getByRole("button", { name: "Agregar equipo" }).click();
  await expect(page.getByText("Extintor EXT-01")).toBeVisible();
  await expect(page.getByText(/Vencido/).first()).toBeVisible();

  dlg = await openModal(page, "Crear o actualizar un plan");
  await dlg.locator("#pl-vulnerabilityAnalysis").fill("Edificio de dos pisos con una sola salida");
  await dlg.getByRole("button", { name: "Guardar plan" }).click();
  await expect(page.getByText("Edificio de dos pisos con una sola salida")).toBeVisible();

  dlg = await openModal(page, "Programar simulacro");
  await dlg.locator("#nd-scenario").fill("Evacuación por incendio");
  await dlg.getByRole("button", { name: "Programar", exact: true }).click();
  dlg = await openModal(page, "Registrar resultado");
  await dlg.locator('[id^="dr-"][id$="-evaluation"]').fill("Evacuación completa en cinco minutos");
  await dlg.locator('[id^="dr-"][id$="-improvements"]').fill("Señalizar la ruta de evacuación B");
  await dlg.getByRole("button", { name: "Registrar simulacro" }).click();
  await expect(page.getByText("Realizado")).toBeVisible();
  await expect(page.getByText(/Aún no hay simulacros realizados/)).toHaveCount(0);

  await page.goto(`${TENANT}/acciones`);
  await expect(page.getByText(/Simulacro: Señalizar la ruta/)).toBeVisible();
});
