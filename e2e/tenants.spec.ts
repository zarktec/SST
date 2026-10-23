import { expect, test } from "@playwright/test";
import { ADMIN, loginAdminWith2fa, resetState } from "./helpers";

test.beforeEach(resetState);

test("SUPER ADMIN crea una empresa, la ve en el listado y opera su suscripción", async ({
  page,
}, info) => {
  await loginAdminWith2fa(page);
  await page.goto(`${ADMIN}/empresas/nueva`);
  await page.getByLabel("Nombre comercial").fill("Constructora E2E");
  await page.getByLabel("Razón social").fill("Constructora E2E S.A.S.");
  await page.getByLabel(/^NIT/).fill("900555111");
  await page.getByLabel("Subdominio").fill("e2e-constructora");
  await page.getByLabel(/^Correo del administrador/).fill("gerente@e2e-constructora.co");
  await page.getByRole("button", { name: "Crear empresa" }).click();

  await expect(page.getByRole("heading", { name: "Constructora E2E" })).toBeVisible();
  await expect(page.getByText("Free Trial")).toBeVisible();
  await expect(page.getByText("e2e-constructora.localhost:3000")).toBeVisible();
  await expect(page.getByText("trial_started")).toBeVisible();

  // Suspender exige motivo
  await page.getByLabel("Motivo").fill("x");
  await page.getByRole("button", { name: /Suspender/ }).click();
  await expect(page.getByText(/Indica el motivo/)).toBeVisible();
  await page.getByLabel("Motivo").fill("Solicitud del cliente");
  await page.getByRole("button", { name: /Suspender/ }).click();
  await expect(page.getByText("Suspendida").first()).toBeVisible();
  await expect(page.getByText(/suspended/)).toBeVisible();

  // Extender la prueba y reactivar
  await page.getByLabel("Días a extender").fill("10");
  await page.getByRole("button", { name: "Extender prueba" }).click();
  await expect(page.getByText("trial_extended")).toBeVisible();
  await page.screenshot({
    path: `test-results/tenant-detail-${info.project.name}.png`,
    fullPage: true,
  });

  // Listado con búsqueda y filtros
  await page.goto(`${ADMIN}/empresas?q=constructora`);
  await expect(page.getByText("Constructora E2E", { exact: true })).toBeVisible();
  await page.goto(`${ADMIN}/empresas?q=constructora&status=cancelled`);
  await expect(page.getByText("No hay empresas con esos filtros.")).toBeVisible();

  // Subdominio duplicado
  await page.goto(`${ADMIN}/empresas/nueva`);
  await page.getByLabel("Nombre comercial").fill("Otra");
  await page.getByLabel("Razón social").fill("Otra S.A.S.");
  await page.getByLabel("Subdominio").fill("e2e-constructora");
  await page.getByLabel(/^Correo del administrador/).fill("otro@otra.co");
  await page.getByRole("button", { name: "Crear empresa" }).click();
  await expect(page.getByText(/ya está en uso/)).toBeVisible();
});

test("la empresa creada tiene su login de marca y el administrador invitado puede entrar por enlace", async ({
  page,
}) => {
  await loginAdminWith2fa(page);
  await page.goto(`${ADMIN}/empresas/nueva`);
  await page.getByLabel("Nombre comercial").fill("Marca E2E");
  await page.getByLabel("Razón social").fill("Marca E2E S.A.S.");
  await page.getByLabel("Subdominio").fill("e2e-marca");
  await page.getByLabel(/^Correo del administrador/).fill("admin@e2e-marca.co");
  await page.getByRole("button", { name: "Crear empresa" }).click();
  await expect(page.getByRole("heading", { name: "Marca E2E" })).toBeVisible();
  await page.goto("http://e2e-marca.localhost:3000/login");
  await expect(page.getByText("Accede a Marca E2E")).toBeVisible();
});
