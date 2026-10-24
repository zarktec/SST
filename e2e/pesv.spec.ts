import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("PESV: vehículo, preoperacional con falla crítica y siniestro", async ({ page }) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
  await page.goto(`${TENANT}/pesv`);
  await page.waitForLoadState("load");

  await page.locator("summary", { hasText: "Agregar vehículo" }).click();
  await page.locator("#nv-plate").fill("abc123");
  await page.locator("#nv-soatExpiresOn").fill("2020-01-01");
  await page.getByRole("button", { name: "Agregar vehículo" }).click();
  await expect(page.getByText("ABC123", { exact: true })).toBeVisible();
  await expect(page.getByText(/SOAT: Vencido/)).toBeVisible();

  await page.locator("#po-ok_0").uncheck();
  await page.locator("#po-note_0").fill("Pedal de freno blando");
  await page.getByRole("button", { name: "Registrar preoperacional" }).click();
  await expect(page.getByText(/1 falla\(s\) crítica\(s\)/)).toBeVisible();

  await page.locator("summary", { hasText: "Registrar siniestro" }).click();
  await page.locator("#cr-driverName").fill("Luis Gómez");
  await page.locator("#cr-place").fill("Autopista Norte km 5");
  await page.locator("#cr-description").fill("Colisión por alcance sin lesionados");
  await page.getByRole("button", { name: "Registrar siniestro" }).click();
  await expect(page.getByText("Colisión por alcance sin lesionados")).toBeVisible();

  await page.goto(`${TENANT}/acciones`);
  await expect(page.getByText(/Vehículo ABC123: corregir Frenos/)).toBeVisible();
});
