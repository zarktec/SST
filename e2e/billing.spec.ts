import { expect, test } from "@playwright/test";
import { TENANT, openModal, resetState } from "./helpers";

test.beforeEach(resetState);

test("landing pública: precios y registro self-service crea la empresa con prueba", async ({
  page,
}) => {
  await page.goto("http://localhost:3000/precios");
  await expect(page.getByRole("heading", { name: "Planes y precios" })).toBeVisible();
  await page.goto("http://localhost:3000/registro");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Razón social o nombre").fill("Empresa E2E SAS");
  await page.getByLabel("Nombre comercial").fill("E2E Registro");
  await page.getByLabel("Dirección de tu empresa").fill("e2e-registro");
  await page.getByLabel("Tu correo (administrador)").fill("dueno@e2e-registro.test");
  await page.getByRole("button", { name: "Crear mi empresa" }).click();
  await expect(page.getByText("Te enviamos un correo")).toBeVisible();
  await expect(page.getByText(/localhost:3000\/e2e-registro/)).toBeVisible();
  // Mismo identificador otra vez: rechazado.
  await page.goto("http://localhost:3000/registro");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Razón social o nombre").fill("Otra SAS");
  await page.getByLabel("Nombre comercial").fill("Otra");
  await page.getByLabel("Dirección de tu empresa").fill("e2e-registro");
  await page.getByLabel("Tu correo (administrador)").fill("otro@e2e-registro.test");
  await page.getByRole("button", { name: "Crear mi empresa" }).click();
  await expect(page.getByText("Ese identificador ya está en uso")).toBeVisible();
});

test("el administrador de la empresa ve Facturación y guarda sus datos fiscales", async ({
  page,
}) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
  await page.goto(`${TENANT}/facturacion`);
  await expect(page.getByRole("heading", { name: "Facturación", exact: true })).toBeVisible();
  await page.waitForLoadState("load");
  await expect(page.getByRole("heading", { name: "Mi plan" })).toBeVisible();
  const dlg = await openModal(page, "Editar datos de facturación");
  await dlg.getByLabel("Número de documento (sin puntos ni DV)").fill("900123456");
  await dlg.getByLabel("Dígito de verificación (NIT)").fill("1");
  await dlg.getByLabel("Razón social o nombre completo").fill("Empresa Demo SAS");
  await dlg.getByLabel("Dirección", { exact: true }).fill("Calle 1 # 2-3");
  await dlg.getByLabel("Municipio (código DANE de 5 dígitos)").fill("11001");
  await dlg.getByLabel("Teléfono").fill("3001234567");
  await dlg.getByLabel("Correo para recibir la factura electrónica").fill("fact@demo.test");
  await dlg.getByLabel(/O-13/).check();
  await dlg.getByRole("button", { name: "Guardar datos de facturación" }).click();
  await expect(
    dlg.getByText(/Dígito de verificación incorrecto \(para este NIT es 8\)/),
  ).toBeVisible();
  await dlg.getByLabel("Dígito de verificación (NIT)").fill("8");
  await dlg.getByRole("button", { name: "Guardar datos de facturación" }).click();
  await expect(page.getByText("Datos de facturación guardados.")).toBeVisible();
});
