import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("acciones CAPA: crear, ejecutar con evidencia y verificar eficacia", async ({ page }) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(`${TENANT}/`);
  await page.goto(`${TENANT}/acciones`);
  await page.waitForLoadState("load");
  await page.getByLabel("Acción", { exact: true }).fill("Reparar la baranda de la escalera");
  await page.getByLabel("Responsable").fill("Luis Gómez");
  await page.getByLabel("Fecha límite").fill("2020-01-01");
  await page.getByRole("button", { name: "Crear acción" }).click();
  await expect(page.getByText("Acción creada.")).toBeVisible();
  await expect(page.getByText(/d de mora/)).toBeVisible();
  await page.getByRole("link", { name: /Reparar la baranda/ }).click();
  await page.waitForLoadState("load");
  await page.getByLabel("Pasar a").selectOption("done");
  await page.getByRole("button", { name: "Actualizar estado" }).click();
  await expect(page.getByText("Registra la evidencia del cierre")).toBeVisible();
  await page.getByLabel(/Evidencia del cierre/).fill("Baranda reparada, acta 5");
  await page.getByRole("button", { name: "Actualizar estado" }).click();
  await expect(page.getByRole("heading", { name: "Verificación de eficacia" })).toBeVisible();
  await page.getByLabel("Cómo se verificó").fill("Sin nuevos eventos en 30 días");
  await page.getByRole("button", { name: "Registrar verificación" }).click();
  await expect(page.getByText(/Verificada como eficaz/)).toBeVisible();
});
