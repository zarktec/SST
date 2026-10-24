import { expect, test, type Page } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

async function login(page: Page) {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
}

test("el administrador completa el onboarding: clasificación, sede y responsable", async ({
  page,
}) => {
  await login(page);
  await page.goto(`${TENANT}/onboarding?paso=1`);
  await expect(page.getByRole("heading", { name: "Datos de la empresa" })).toBeVisible();
  await page.waitForLoadState("load");
  await page.getByLabel("NIT (sin DV ni puntos)").fill("900123456");
  await page.getByLabel("Dígito de verificación").fill("1");
  await page.getByLabel("Razón social").fill("Empresa Demo S.A.S.");
  await page.getByLabel("Nombre comercial").fill("Empresa Demo");
  await page.getByLabel(/Actividad económica/).fill("4711");
  await page.getByLabel("Clase de riesgo (1 a 5)").fill("1");
  await page.getByLabel("ARL", { exact: true }).fill("Sura");
  await page.getByLabel("Representante legal").fill("Ana Pérez");
  await page.getByLabel("Número de trabajadores").fill("8");
  await page.getByRole("button", { name: "Guardar y clasificar" }).click();
  await expect(
    page.getByText(/Dígito de verificación incorrecto \(para este NIT es 8\)/),
  ).toBeVisible();
  await page.getByLabel("Dígito de verificación").fill("8");
  await page.getByRole("button", { name: "Guardar y clasificar" }).click();
  await expect(page.getByText("Te aplican 7 estándares mínimos")).toBeVisible();

  await page.goto(`${TENANT}/onboarding?paso=2`);
  await page.waitForLoadState("load");
  await page.getByLabel("Nombre de la sede").last().fill("Sede principal");
  await page.getByRole("button", { name: "Agregar sede" }).click();
  await expect(page.getByText("Sede guardada.")).toBeVisible();

  await page.goto(`${TENANT}/onboarding?paso=3`);
  await expect(page.getByRole("heading", { name: "Responsable del SG-SST" })).toBeVisible();
  await page.waitForLoadState("load");
  await page.getByLabel("Nombre completo").fill("Luis Gómez");
  await page.getByLabel("Número de documento").fill("1032456789");
  await page.getByLabel("Correo").fill("luis@demo.test");
  await page.getByLabel("Licencia en SST (número)").fill("L-123");
  await page.getByLabel("Vigencia de la licencia").fill("2032-01-01");
  await page.getByLabel(/Curso de 50 horas: fecha/).fill("2025-06-01");
  await page.getByRole("button", { name: "Guardar responsable" }).click();
  await expect(page.getByText("Responsable del SG-SST guardado.")).toBeVisible();

  await page.goto(`${TENANT}/onboarding?paso=5`);
  await expect(page.getByText("Estándares mínimos aplicables:")).toBeVisible();
  await page.getByRole("button", { name: "Finalizar onboarding" }).click();
  await page.waitForURL(TENANT);
  await expect(page.getByText("Te aplican 7 estándares mínimos")).toBeVisible();
});
