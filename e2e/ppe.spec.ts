import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("EPP: crear elemento, ingresar inventario y entregar con firma", async ({ page }) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);

  await page.goto(`${TENANT}/personas/nuevo`);
  await page.waitForLoadState("load");
  await page.getByLabel("Número de documento").fill("1032456789");
  await page.getByLabel("Nombre completo").fill("Ana Pérez");
  await page.getByLabel("Fecha de ingreso").fill("2024-03-01");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("Persona registrada.")).toBeVisible();

  await page.goto(`${TENANT}/epp/catalogo`);
  await page.waitForLoadState("load");
  await page.getByLabel("Nombre del EPP").fill("Casco de seguridad");
  await page.getByLabel(/Vida útil/).fill("24");
  await page.getByRole("button", { name: "Crear EPP" }).click();
  await expect(page.getByText("EPP guardado.")).toBeVisible();
  await page.getByLabel("Cantidad").fill("10");
  await page.getByRole("button", { name: "Registrar ingreso" }).click();
  await expect(page.getByText("Ingreso registrado.")).toBeVisible();

  await page.goto(`${TENANT}/epp`);
  await page.waitForLoadState("load");
  await page.getByLabel("Cantidad").fill("2");
  const canvas = page.getByLabel("Área para firmar");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 40);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++)
    await page.mouse.move(box.x + 20 + i * 12, box.y + 40 + (i % 3) * 25);
  await page.mouse.up();
  await page.getByRole("button", { name: "Registrar entrega" }).click();
  await expect(page.getByText("Entrega registrada.")).toBeVisible();
  await expect(page.getByText(/2 × Casco de seguridad/)).toBeVisible();
});
