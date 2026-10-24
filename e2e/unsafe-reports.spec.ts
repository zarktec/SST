import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("reporte anónimo desde el celular y conversión a acción por el revisor", async ({ page }) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
  await page.goto(`${TENANT}/reportes`);
  await page.waitForLoadState("load");
  await page.getByLabel("Descripción").fill("Extintor sin carga en el pasillo");
  await page.getByLabel("Lugar (opcional)").fill("Pasillo 3");
  await page.getByLabel(/Enviar de forma anónima/).check();
  await page.getByRole("button", { name: "Enviar reporte" }).click();
  await expect(page.getByText("Extintor sin carga en el pasillo")).toBeVisible();
  await expect(page.getByText(/· anónimo/)).toBeVisible();
  await page.getByLabel("Acción", { exact: true }).fill("Recargar el extintor del pasillo 3");
  await page.getByLabel("Responsable").fill("Luis Gómez");
  await page.getByLabel("Fecha límite").fill("2030-01-01");
  await page.getByRole("button", { name: "Registrar revisión" }).click();
  await expect(page.getByRole("link", { name: "Ver la acción" })).toBeVisible();
  await expect(page.getByText("Con acción")).toBeVisible();
});
