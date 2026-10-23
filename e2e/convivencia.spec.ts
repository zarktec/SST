import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("convivencia: cualquier persona radica de forma confidencial; sin el rol no ve las quejas ni el canal de acoso sexual", async ({
  page,
}) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(`${TENANT}/`);

  await page.goto(`${TENANT}/convivencia/radicar`);
  await page.waitForLoadState("load");
  await page
    .getByLabel(/Describe los hechos/)
    .fill("El lunes en la bodega me gritaron delante de todos mis compañeros.");
  await page.getByLabel(/anónima/).check();
  await page.getByRole("button", { name: "Radicar queja" }).click();
  await expect(page.getByText(/recibida de forma confidencial/)).toBeVisible();

  // El administrador no es miembro del comité: ve el módulo pero no las quejas.
  await page.goto(`${TENANT}/convivencia`);
  await expect(
    page.getByRole("heading", { name: "Convivencia laboral", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Quejas \(/)).toHaveCount(0);

  // Canal de acoso sexual: puede reportar, pero la bandeja es solo de la alta dirección.
  await page.goto(`${TENANT}/acoso-sexual/radicar`);
  await page.waitForLoadState("load");
  await page
    .getByLabel("Describe lo ocurrido")
    .fill("Un superior me hizo comentarios inapropiados de forma repetida en la oficina.");
  await page.getByRole("button", { name: "Enviar reporte" }).click();
  await expect(page.getByText(/No lo recibe el Comité de Convivencia/)).toBeVisible();
  await page.goto(`${TENANT}/acoso-sexual`);
  await expect(page).toHaveURL(`${TENANT}/`);
});
