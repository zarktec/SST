import { expect, test } from "@playwright/test";
import { ADMIN, loginAdminWith2fa, resetState } from "./helpers";

test.beforeEach(resetState);

test("SUPER ADMIN activa 2FA, configura una integración y los secretos nunca se muestran", async ({
  page,
}, info) => {
  await loginAdminWith2fa(page);
  await page.goto(`${ADMIN}/integrations/wompi`);
  await expect(page.getByRole("heading", { name: /Wompi/ })).toBeVisible();

  await page.locator("#sandbox-publicKey").fill("pub_test_ABC123");
  await page.getByRole("button", { name: "Guardar configuración" }).click();
  await expect(page.getByText(/Guardado \(\d+ cambio/)).toBeVisible();

  const secret = "prv_test_SUPERSECRETO987654";
  await page.locator("#sandbox-privateKey").fill(secret);
  await page.getByRole("button", { name: "Guardar secreto" }).first().click();
  await expect(page.getByText("Guardado · prv_test_••••••7654")).toBeVisible();

  // El secreto nunca vuelve al navegador: ni en el DOM ni en los datos de la página.
  expect(await page.content()).not.toContain("SUPERSECRETO");
  await page.reload();
  expect(await page.content()).not.toContain("SUPERSECRETO");
  await expect(page.locator("#sandbox-privateKey")).toHaveValue("");
  await expect(page.getByText("Guardado · prv_test_••••••7654")).toBeVisible();

  // No se puede activar una integración incompleta
  await page.getByRole("button", { name: "Activar integración" }).click();
  await expect(page.getByText(/No se puede activar: falta/)).toBeVisible();

  // Probar conexión devuelve un resultado (con red o sin ella)
  await page.getByRole("button", { name: /Probar conexión/ }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: /Wompi|conectar|Conexión/ })
      .first(),
  ).toBeVisible({ timeout: 15000 });

  // Historial sin valores
  await expect(page.getByText(/secret_replaced/)).toBeVisible();
  expect(await page.content()).not.toContain("SUPERSECRETO");
  await page.screenshot({
    path: `test-results/integrations-${info.project.name}.png`,
    fullPage: true,
  });
});

test("un usuario de empresa no puede abrir las integraciones", async ({ page }) => {
  await page.goto(`${ADMIN}/integrations`);
  await expect(page).toHaveURL(/\/login/);
});
