import { expect, test } from "@playwright/test";
import { TENANT, openModal, resetState } from "./helpers";

test.beforeEach(resetState);

test("tablero de indicadores: meta de la empresa y análisis del periodo", async ({ page }) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
  await page.goto(`${TENANT}/indicadores`);
  await page.waitForLoadState("load");
  await expect(page.getByRole("heading", { name: "Frecuencia de accidentalidad" })).toBeVisible();
  let dlg = await openModal(page, "Definir meta");
  await dlg.locator("#frecuencia_accidentalidad-target").fill("2");
  await dlg.getByRole("button", { name: "Guardar meta" }).click();
  await expect(page.getByText("(de la empresa)")).toBeVisible();
  dlg = await openModal(page, "Registrar análisis");
  await dlg.locator("#a-frecuencia_accidentalidad").fill("Sin accidentes en el periodo");
  await dlg.getByRole("button", { name: "Guardar análisis" }).click();
  await expect(page.getByText("Análisis guardado.")).toBeVisible();
  dlg = await openModal(page, "Registrar análisis");
  await expect(dlg.locator("#a-frecuencia_accidentalidad")).toHaveValue(
    "Sin accidentes en el periodo",
  );
});
