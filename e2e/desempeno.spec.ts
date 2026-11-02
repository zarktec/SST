import { expect, test } from "@playwright/test";
import { TENANT, openModal, resetState } from "./helpers";

test.beforeEach(resetState);

test("Evaluación 360: ajuste de anonimato y creación de un ciclo", async ({ page }) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
  await page.goto(`${TENANT}/desempeno`);
  await page.waitForLoadState("load");

  await expect(page.getByText("No tienes evaluaciones pendientes.")).toBeVisible();
  // Por defecto los ciclos son anónimos; la empresa lo cambia.
  const anon = page.getByLabel(/Evaluaciones anónimas/);
  await expect(anon).toBeChecked();
  await anon.uncheck();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText(/Configuración guardada/)).toBeVisible();

  const dlg = await openModal(page, "Nuevo ciclo");
  await dlg.locator("#cy-name").fill("Evaluación 2026");
  await dlg.getByRole("button", { name: "Crear ciclo" }).click();
  await expect(page.getByRole("link", { name: "Evaluación 2026" })).toBeVisible();
  await expect(page.getByText("Identificado", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Evaluación 2026" }).click();
  await expect(page.getByRole("heading", { name: "Evaluación 2026" })).toBeVisible();
  await expect(page.getByText("Agrega a las personas que van a ser evaluadas.")).toBeVisible();
});
