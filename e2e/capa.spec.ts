import { expect, test } from "@playwright/test";
import { TENANT, openModal, resetState } from "./helpers";

test.beforeEach(resetState);

test("acciones CAPA: crear, ejecutar con evidencia y verificar eficacia", async ({ page }) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
  await page.goto(`${TENANT}/acciones`);
  await page.waitForLoadState("load");
  let dlg = await openModal(page, "Nueva acción");
  await dlg.getByLabel("Acción", { exact: true }).fill("Reparar la baranda de la escalera");
  await dlg.getByLabel("Responsable").fill("Luis Gómez");
  await dlg.getByLabel("Fecha límite").fill("2020-01-01");
  await dlg.getByRole("button", { name: "Crear acción" }).click();
  await expect(page.getByText("Acción creada.")).toBeVisible();
  await expect(page.getByText(/d de mora/)).toBeVisible();
  await page.getByRole("link", { name: /Reparar la baranda/ }).click();
  await page.waitForLoadState("load");
  dlg = await openModal(page, "Cambiar estado");
  await dlg.getByLabel("Pasar a").selectOption("done");
  await dlg.getByRole("button", { name: "Actualizar estado" }).click();
  await expect(dlg.getByText("Registra la evidencia del cierre")).toBeVisible();
  await dlg.getByLabel(/Evidencia del cierre/).fill("Baranda reparada, acta 5");
  await dlg.getByRole("button", { name: "Actualizar estado" }).click();
  await expect(page.getByRole("heading", { name: "Verificación de eficacia" })).toBeVisible();
  dlg = await openModal(page, "Verificar eficacia");
  await dlg.getByLabel("Cómo se verificó").fill("Sin nuevos eventos en 30 días");
  await dlg.getByRole("button", { name: "Registrar verificación" }).click();
  await expect(page.getByText(/Verificada como eficaz/)).toBeVisible();
});
