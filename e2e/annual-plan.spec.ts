import { expect, test } from "@playwright/test";
import { TENANT, openModal, resetState } from "./helpers";

test.beforeEach(resetState);

test("plan anual: crear, agregar actividad, completar con evidencia y firmar", async ({ page }) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
  const year = new Date().getUTCFullYear();
  await page.goto(`${TENANT}/plan-anual`);
  await expect(page.getByRole("heading", { name: `Plan anual de trabajo ${year}` })).toBeVisible();
  await page.waitForLoadState("load");
  await page.getByRole("button", { name: `Crear plan ${year}` }).click();
  await page.waitForLoadState("load");

  let dlg = await openModal(page, "Agregar actividad");
  await dlg.getByLabel("Actividad", { exact: true }).fill("Revisar la política de SST");
  await dlg.getByLabel("Inicio").fill(`${year}-02-01`);
  await dlg.getByLabel("Fin").fill(`${year}-03-15`);
  await dlg.getByRole("button", { name: "Agregar actividad" }).click();
  await expect(page.getByText("0% de cumplimiento")).toBeVisible();
  await expect(page.getByText("Revisar la política de SST").first()).toBeVisible();

  dlg = await openModal(page, "Gestionar");
  await dlg.getByLabel("Estado").selectOption("done");
  await dlg.getByRole("button", { name: "Guardar estado" }).click();
  await expect(dlg.getByText("Registra la evidencia de la ejecución")).toBeVisible();
  await dlg.getByLabel(/Evidencia/).fill("Acta 3 de la alta dirección");
  await dlg.getByRole("button", { name: "Guardar estado" }).click();
  await expect(page.getByText("100% de cumplimiento")).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Firmar como empleador" }).click();
  await expect(page.getByText("Firmas: empleador ✓ · responsable pendiente")).toBeVisible();
});
