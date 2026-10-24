import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

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
  await page.locator("#frecuencia_accidentalidad-target").fill("2");
  await page.getByRole("button", { name: "Guardar meta" }).first().click();
  await expect(page.getByText("(de la empresa)")).toBeVisible();
  await page.locator("#a-frecuencia_accidentalidad").fill("Sin accidentes en el periodo");
  await page.getByRole("button", { name: "Guardar análisis" }).first().click();
  await expect(page.locator("#a-frecuencia_accidentalidad")).toHaveValue(
    "Sin accidentes en el periodo",
  );
});
