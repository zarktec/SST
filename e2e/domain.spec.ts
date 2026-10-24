import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("el administrador ve su dirección y conecta un dominio propio con sus instrucciones DNS", async ({
  page,
}) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
  await page.getByRole("link", { name: "Dominio propio" }).click();
  await expect(page).toHaveURL(`${TENANT}/dominio`);
  await expect(page.getByRole("heading", { name: "Dominio propio" })).toBeVisible();
  await expect(page.getByText("localhost:3000/demo").first()).toBeVisible();
  await page.getByLabel("Tu dominio").fill("sst.empresa-demo.com");
  await page.getByRole("button", { name: "Conectar dominio" }).click();
  // La página se refresca sola: aparece el dominio con su estado (sin proveedor real en local queda verificado)
  await expect(page.getByText("sst.empresa-demo.com").first()).toBeVisible();
  await expect(page.getByText("Verificado")).toBeVisible();
  // Con un dominio activo ya no se ofrece conectar otro
  await expect(page.getByText("Conectar un dominio")).toHaveCount(0);
});
