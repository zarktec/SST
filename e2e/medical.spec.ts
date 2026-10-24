import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("medicina del trabajo: bloqueo de pruebas discriminatorias, resultado con tarea de adaptación y ausentismo", async ({
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

  await page.goto(`${TENANT}/medicina`);
  await expect(
    page.getByRole("heading", { name: "Medicina del trabajo", exact: true }),
  ).toBeVisible();
  await page.waitForLoadState("load");
  await page.getByLabel("Observaciones de la solicitud").fill("Incluir prueba de embarazo");
  await page.getByRole("button", { name: "Programar evaluación" }).click();
  await expect(page.getByText(/discriminatorio/)).toBeVisible();
  await page.getByLabel("Observaciones de la solicitud").fill("Audiometría y optometría");
  await page.getByRole("button", { name: "Programar evaluación" }).click();
  await expect(page.getByText("Evaluación programada.")).toBeVisible();

  await page.locator("summary", { hasText: "Registrar resultado" }).click();
  await page.getByLabel("Concepto de aptitud").selectOption("apto_restricciones");
  await page.getByLabel("Recomendaciones").fill("Pausas activas cada dos horas");
  await page.getByRole("button", { name: "Registrar resultado" }).click();
  await expect(page.getByText("Adaptación del puesto pendiente")).toBeVisible();

  await page.goto(`${TENANT}/medicina/ausentismo`);
  await page.waitForLoadState("load");
  await page.getByLabel("Causa").selectOption("common_illness");
  await page.getByRole("button", { name: "Registrar ausencia" }).click();
  await expect(page.getByText("Ausencia registrada.")).toBeVisible();
  await expect(page.getByText(/% de ausentismo/)).toBeVisible();
});
