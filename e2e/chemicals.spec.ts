import { expect, test } from "@playwright/test";
import { TENANT, openModal, resetState } from "./helpers";

test.beforeEach(resetState);

test("inventario químico: alerta de almacenamiento incompatible y revisión de la FDS", async ({
  page,
}) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
  await page.goto(`${TENANT}/quimicos`);
  await page.waitForLoadState("load");

  const add = async (name: string, picto: string) => {
    const dlg = await openModal(page, "Agregar sustancia");
    await dlg.locator("#ns-name").fill(name);
    await dlg.locator("#ns-location").fill("Bodega A");
    await dlg.locator(`#ns-p_${picto}`).check();
    await dlg.getByRole("button", { name: "Agregar sustancia" }).click();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  };
  await add("Acetona", "GHS02");
  await expect(page.getByText(/Almacenamiento incompatible/)).toHaveCount(0);
  await add("Peróxido de hidrógeno", "GHS03");
  await expect(page.getByText(/Inflamable con Comburente/)).toBeVisible();
  await expect(page.getByText("Sin ficha de datos de seguridad (FDS)").first()).toBeVisible();

  const dlg = await openModal(page, "Editar o retirar");
  await dlg.getByRole("button", { name: "Registrar revisión" }).click();
  await expect(page.getByText("Sin ficha de datos de seguridad (FDS)")).toHaveCount(1);
});
