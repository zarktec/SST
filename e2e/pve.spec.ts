import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("vigilancia: programa, caso con seguimiento cifrado y batería psicosocial", async ({
  page,
}) => {
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

  await page.goto(`${TENANT}/vigilancia`);
  await page.waitForLoadState("load");
  await expect(page.getByText(/Aún no hay aplicación de la batería/)).toBeVisible();
  await page.locator("#np-name").fill("PVE osteomuscular");
  await page.getByRole("button", { name: "Crear programa" }).click();
  await expect(page.getByRole("heading", { name: "PVE osteomuscular" })).toBeVisible();

  await page.locator("summary", { hasText: "Abrir un caso" }).click();
  await page.locator("#nc-notes").fill("Dolor lumbar recurrente por cargas");
  await page.getByRole("button", { name: "Abrir caso" }).click();
  await page.getByRole("link", { name: /Ana Pérez/ }).click();
  await page.waitForLoadState("load");
  await expect(page.getByText("Dolor lumbar recurrente por cargas")).toBeVisible();
  await page.locator("#fu-note").fill("Control con fisioterapia, mejora parcial");
  await page.getByRole("button", { name: "Registrar seguimiento" }).click();
  await expect(page.getByText("Control con fisioterapia, mejora parcial")).toBeVisible();

  await page.goto(`${TENANT}/vigilancia/psicosocial`);
  await page.waitForLoadState("load");
  await page.locator("#ps-psychologistName").fill("Dra. Ana Ruiz");
  await page.locator("#ps-licenseNumber").fill("SST-12345");
  await page.locator("#ps-riskLevel").selectOption("high");
  await page.locator("#ps-interventions").fill("Capacitar en manejo del estrés");
  await page.getByRole("button", { name: "Registrar aplicación" }).click();
  await expect(page.getByRole("listitem").getByText("Riesgo alto")).toBeVisible();
  await page.goto(`${TENANT}/acciones`);
  await expect(page.getByText(/Intervención psicosocial: Capacitar/)).toBeVisible();
});
