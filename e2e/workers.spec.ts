import { expect, test, type Page } from "@playwright/test";
import { TENANT, openModal, resetState } from "./helpers";

test.beforeEach(resetState);

async function login(page: Page) {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
}

test("registrar, buscar, cargar masivamente y retirar personas", async ({ page }) => {
  await login(page);
  await page.goto(`${TENANT}/personas`);
  await page.waitForLoadState("load");
  let dlg = await openModal(page, "Registrar");
  await dlg.getByLabel("Número de documento").fill("1032456789");
  await dlg.getByLabel("Nombre completo").fill("Ana Pérez");
  await dlg.getByLabel("Cargo").fill("Operaria");
  await dlg.getByLabel("Fecha de ingreso").fill("2024-03-01");
  await dlg.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("Persona registrada.")).toBeVisible();
  // Duplicado
  dlg = await openModal(page, "Registrar");
  await dlg.getByLabel("Número de documento").fill("1032456789");
  await dlg.getByLabel("Nombre completo").fill("Otra Ana");
  await dlg.getByLabel("Fecha de ingreso").fill("2024-03-01");
  await dlg.getByRole("button", { name: "Registrar" }).click();
  await expect(dlg.getByText("Ya existe una persona con ese documento")).toBeVisible();
  await dlg.getByRole("button", { name: "Cerrar" }).click();

  dlg = await openModal(page, "Carga masiva");
  const csv = [
    "vinculacion,tipo_documento,documento,nombre,fecha_ingreso",
    "Contratista,CC,2222222222,Luis Contratista,2024-02-01",
    "Empleado,CC,abc,Malo,2024-02-01",
  ].join("\n");
  await dlg
    .getByLabel(/Archivo CSV/)
    .setInputFiles({ name: "p.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await dlg.getByRole("button", { name: "Importar" }).click();
  await expect(dlg.getByText("Importadas: 1. Omitidas: 0. Con error: 1.")).toBeVisible();
  await expect(dlg.getByText(/Fila 3/)).toBeVisible();
  await dlg.getByRole("button", { name: "Cerrar" }).click();

  await page.goto(`${TENANT}/personas?q=1032456789`);
  await expect(page.getByRole("link", { name: /Ana Pérez/ })).toBeVisible();
  // El contratista sin verificación aparece en el aviso de seguridad social aunque el filtro no lo incluya.
  await expect(page.getByText("Seguridad social de contratistas")).toBeVisible();
  await page.getByRole("link", { name: /Luis Contratista/ }).click();
  await page.waitForLoadState("load");
  dlg = await openModal(page, "Verificar seguridad social");
  await dlg.getByRole("button", { name: "Registrar verificación" }).click();
  await expect(page.getByText("Verificación registrada.")).toBeVisible();

  await page.goto(`${TENANT}/personas?q=Ana`);
  await page.getByRole("link", { name: /Ana Pérez/ }).click();
  await page.waitForLoadState("load");
  dlg = await openModal(page, "Registrar retiro");
  await dlg.getByLabel("Registrar retiro con fecha").fill("2025-01-31");
  await dlg.getByRole("button", { name: "Registrar retiro" }).click();
  await expect(page.getByText("Retiro registrado.")).toBeVisible();
});
