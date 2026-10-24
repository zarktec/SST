import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

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
  await expect(page.getByRole("heading", { name: "Agregar actividad" })).toBeVisible();
  await page.waitForLoadState("load");

  await page.getByLabel("Actividad", { exact: true }).fill("Revisar la política de SST");
  await page.getByLabel("Inicio").fill(`${year}-02-01`);
  await page.getByLabel("Fin").fill(`${year}-03-15`);
  await page.getByRole("button", { name: "Agregar actividad" }).click();
  await expect(page.getByText("0% de cumplimiento")).toBeVisible();
  await expect(page.getByText("Revisar la política de SST").first()).toBeVisible();

  await page.getByText("Gestionar").click();
  await page.getByLabel("Estado").selectOption("done");
  await page.getByRole("button", { name: "Guardar estado" }).click();
  await expect(page.getByText("Registra la evidencia de la ejecución")).toBeVisible();
  await page.getByLabel(/Evidencia/).fill("Acta 3 de la alta dirección");
  await page.getByRole("button", { name: "Guardar estado" }).click();
  await expect(page.getByText("100% de cumplimiento")).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Firmar como empleador" }).click();
  await expect(page.getByText("Firmas: empleador ✓ · responsable pendiente")).toBeVisible();
});
