import { expect, test } from "@playwright/test";
import { TENANT, resetState, openModal } from "./helpers";

test.beforeEach(resetState);

test("EPP: crear elemento, ingresar inventario y entregar con firma", async ({ page }) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);

  await page.goto(`${TENANT}/personas`);
  await page.waitForLoadState("load");
  const personDlg = await openModal(page, "Registrar");
  await personDlg.getByLabel("Número de documento").fill("1032456789");
  await personDlg.getByLabel("Nombre completo").fill("Ana Pérez");
  await personDlg.getByLabel("Fecha de ingreso").fill("2024-03-01");
  await personDlg.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("Persona registrada.")).toBeVisible();

  await page.goto(`${TENANT}/epp/catalogo`);
  await page.waitForLoadState("load");
  let dlg = await openModal(page, "Agregar elemento");
  await dlg.getByLabel("Nombre del EPP").fill("Casco de seguridad");
  await dlg.getByLabel(/Vida útil/).fill("24");
  await dlg.getByRole("button", { name: "Crear EPP" }).click();
  await expect(page.getByText("EPP guardado.")).toBeVisible();
  dlg = await openModal(page, "Registrar movimiento de inventario");
  await dlg.getByLabel("Cantidad").fill("10");
  await dlg.getByRole("button", { name: "Registrar ingreso" }).click();
  await expect(page.getByText("Ingreso registrado.")).toBeVisible();

  await page.goto(`${TENANT}/epp`);
  await page.waitForLoadState("load");
  const dlg2 = await openModal(page, "Registrar entrega");
  await dlg2.getByLabel("Cantidad").fill("2");
  await page.waitForTimeout(300); // animación de entrada del modal
  const canvas = dlg2.getByLabel("Área para firmar");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 40);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++)
    await page.mouse.move(box.x + 20 + i * 12, box.y + 40 + (i % 3) * 25);
  await page.mouse.up();
  await dlg2.getByRole("button", { name: "Registrar entrega" }).click();
  await expect(page.getByText("Entrega registrada.")).toBeVisible();
  await expect(page.getByText(/2 × Casco de seguridad/)).toBeVisible();
});
