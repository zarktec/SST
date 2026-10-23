import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("matriz legal: evaluar una norma", async ({ page }) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(`${TENANT}/`);
  await expect(page.getByText(/sin evaluar en tu matriz legal/)).toBeVisible();
  await page.goto(`${TENANT}/matriz-legal`);
  await expect(page.getByRole("heading", { name: "Matriz legal" })).toBeVisible();
  await page.waitForLoadState("load");
  await page.locator("summary").first().click();
  const form = page.locator("details[open] form").first();
  await form.locator('select[name="applies"]').selectOption("no");
  await form.getByRole("button", { name: "Guardar" }).click();
  await expect(form.getByText("Si no aplica, explica por qué")).toBeVisible();
  await form.getByLabel("Justificación (si no aplica)").fill("No aplica a nuestra actividad");
  await form.getByRole("button", { name: "Guardar" }).click();
  await expect(form.getByText("Guardado.")).toBeVisible();
});
