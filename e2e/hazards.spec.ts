import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("matriz de peligros: crear, valorar automáticamente y aprobar", async ({ page }) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
  await page.goto(`${TENANT}/peligros`);
  await expect(page.getByRole("heading", { name: /Matriz de peligros/ })).toBeVisible();
  await page.waitForLoadState("load");
  await page.getByRole("button", { name: "Crear matriz" }).click();
  await expect(page.getByRole("heading", { name: "Agregar peligro" })).toBeVisible();
  await page.waitForLoadState("load");

  await page.getByLabel("Proceso", { exact: true }).fill("Mantenimiento");
  await page.getByLabel("Actividad", { exact: true }).fill("Trabajo en alturas");
  await page.getByLabel("Tarea", { exact: true }).fill("Cambio de luminarias");
  await page.getByLabel("Familia del peligro").fill("Seguridad");
  await page.getByLabel("Peligro", { exact: true }).fill("Caída de altura");
  await page.getByLabel("Nivel de deficiencia").selectOption("Muy alto");
  await page.getByLabel("Nivel de exposición").selectOption("Continua");
  await page.getByLabel("Nivel de consecuencia").selectOption("Mortal o catastrófico");
  await page.getByRole("button", { name: "Agregar peligro" }).click();
  await expect(page.getByText("Riesgo I · NR 4000")).toBeVisible();
  await expect(page.getByText("Riesgo no aceptable sin controles propuestos")).toBeVisible();

  await page.getByRole("button", { name: "Aprobar matriz" }).click(); // diálogo
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Aprobar matriz" }).click();
  await expect(page.getByText(/participaron los trabajadores/)).toBeVisible();

  await page.getByLabel(/Participación de los trabajadores/).fill("Taller con COPASST");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Participación guardada.")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Aprobar matriz" }).click();
  await expect(page.getByText(/^Aprobada /)).toBeVisible();
});
