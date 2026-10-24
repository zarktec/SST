import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("portal del trabajador, autorización de datos, solicitud de titular y búsqueda global", async ({
  page,
}) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);

  // Sin ficha vinculada, el portal lo avisa.
  await page.goto(`${TENANT}/portal`);
  await expect(page.getByText(/no está vinculado a una persona registrada/)).toBeVisible();

  // Se registra la persona con el mismo correo de la cuenta.
  await page.goto(`${TENANT}/personas/nuevo`);
  await page.waitForLoadState("load");
  await page.getByLabel("Número de documento").fill("1032456789");
  await page.getByLabel("Nombre completo").fill("Ana Pérez Baranda");
  await page.getByLabel("Fecha de ingreso").fill("2024-03-01");
  await page.getByLabel("Correo", { exact: true }).fill("Demo@demo.test");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("Persona registrada.")).toBeVisible();
  await page.goto(`${TENANT}/portal`);
  await expect(page.getByText(/no está vinculado a una persona registrada/)).toHaveCount(0);
  await expect(page.getByText("Autorizar el tratamiento de tus datos personales")).toBeVisible();

  // Autorización de tratamiento de datos (la general es obligatoria).
  await page.goto(`${TENANT}/privacidad`);
  await page.waitForLoadState("load");
  await page.getByRole("button", { name: "Guardar mi autorización" }).click();
  await expect(page.getByText(/Debes autorizar el tratamiento/)).toBeVisible();
  await page.locator("#co-general").check();
  await page.getByRole("button", { name: "Guardar mi autorización" }).click();
  await expect(page.getByText("Autorizado", { exact: true })).toBeVisible();

  // Solicitud del titular y respuesta de la administración.
  await page.locator("#rq-detail").fill("Quiero conocer qué datos míos tienen registrados");
  await page.getByRole("button", { name: "Radicar solicitud" }).click();
  await expect(page.getByText(/En trámite/)).toBeVisible();
  await page.goto(`${TENANT}/privacidad/solicitudes`);
  await page.locator("summary", { hasText: "Responder" }).click();
  await page
    .locator('[id^="rs-"][id$="-resolution"]')
    .fill("Te enviamos la copia de tus datos al correo registrado.");
  await page.getByRole("button", { name: "Registrar respuesta" }).click();
  await expect(page.getByText(/Respuesta: Te enviamos la copia/)).toBeVisible();

  // Búsqueda global.
  await page.goto(`${TENANT}/buscar?q=baranda`);
  await expect(page.getByRole("link", { name: /Ana Pérez Baranda/ })).toBeVisible();
  await page.goto(`${TENANT}/buscar?q=zzzzzz`);
  await expect(page.getByText(/Sin resultados/)).toBeVisible();
});
