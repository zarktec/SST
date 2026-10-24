import { expect, test } from "@playwright/test";
import { TENANT, openModal, resetState } from "./helpers";

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
  await page.waitForLoadState("load");

  let dlg = await openModal(page, "Agregar peligro");
  await dlg.getByLabel("Proceso", { exact: true }).fill("Mantenimiento");
  await dlg.getByLabel("Actividad", { exact: true }).fill("Trabajo en alturas");
  await dlg.getByLabel("Tarea", { exact: true }).fill("Cambio de luminarias");
  await dlg.getByLabel("Familia del peligro").fill("Seguridad");
  await dlg.getByLabel("Peligro", { exact: true }).fill("Caída de altura");
  await dlg.getByLabel("Nivel de deficiencia").selectOption("Muy alto");
  await dlg.getByLabel("Nivel de exposición").selectOption("Continua");
  await dlg.getByLabel("Nivel de consecuencia").selectOption("Mortal o catastrófico");
  await dlg.getByRole("button", { name: "Agregar peligro" }).click();
  await expect(page.getByText("Riesgo I · NR 4000")).toBeVisible();
  await expect(page.getByText("Riesgo no aceptable sin controles propuestos")).toBeVisible();

  await page.getByRole("button", { name: "Aprobar matriz" }).click(); // diálogo
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Aprobar matriz" }).click();
  await expect(page.getByText(/participaron los trabajadores/)).toBeVisible();

  dlg = await openModal(page, "Registrar participación");
  await dlg.getByLabel(/Participación de los trabajadores/).fill("Taller con COPASST");
  await dlg.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Participación guardada.")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Aprobar matriz" }).click();
  await expect(page.getByText(/^Aprobada /)).toBeVisible();
});
