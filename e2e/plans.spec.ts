import { expect, test } from "@playwright/test";
import { ADMIN, loginAdminWith2fa, resetState } from "./helpers";

test.beforeEach(resetState);

test("SUPER ADMIN crea y edita un plan con IVA configurable y crea un cupón", async ({
  page,
}, info) => {
  await loginAdminWith2fa(page);
  await page.goto(`${ADMIN}/planes/nuevo`);
  await page.getByLabel(/^Clave/).fill("e2e-plan");
  await page.getByLabel("Nombre").fill("Plan E2E");
  await page.getByLabel("Precio mensual (COP)").fill("200000");
  await page.getByLabel("Precio anual (COP)").fill("2000000");

  // Vista previa en vivo: IVA aparte 19 % → total $238.000
  await expect(page.getByText(/Mensual: neto .*200\.000.*total .*238\.000/)).toBeVisible();
  // IVA incluido: neto 168.067 + IVA 31.933 = 200.000
  await page.getByLabel("El precio ya incluye IVA").check();
  await expect(page.getByText(/Mensual: neto .*168\.067.*total .*200\.000/)).toBeVisible();
  await page.getByLabel("El precio ya incluye IVA").uncheck();

  await page.getByRole("button", { name: "Crear plan" }).click();
  await expect(page.getByRole("heading", { name: "Plan E2E" })).toBeVisible();

  // Edita el precio mensual y quita el anual
  await page.getByLabel("Precio mensual (COP)").fill("250000");
  await page.getByLabel("Precio anual (COP)").fill("");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText(/Plan guardado/)).toBeVisible();

  await page.goto(`${ADMIN}/planes`);
  await expect(page.getByText("Plan E2E")).toBeVisible();
  await expect(page.getByText(/297\.500/)).toBeVisible(); // 250.000 + 19 %
  await page.screenshot({ path: `test-results/plans-${info.project.name}.png`, fullPage: true });

  // Cupón
  await page.goto(`${ADMIN}/cupones`);
  await page.getByLabel("Código").fill("e2e10");
  await page.getByLabel(/^Valor/).fill("10");
  await page.getByRole("button", { name: "Crear cupón" }).click();
  await expect(page.getByText("Cupón E2E10 creado.")).toBeVisible();
  await expect(page.getByText("E2E10").first()).toBeVisible();
  // Duplicado
  await page.getByLabel("Código").fill("E2E10");
  await page.getByLabel(/^Valor/).fill("5");
  await page.getByRole("button", { name: "Crear cupón" }).click();
  await expect(page.getByText(/Ya existe un cupón/)).toBeVisible();
});

test("validaciones del formulario de planes", async ({ page }) => {
  await loginAdminWith2fa(page);
  await page.goto(`${ADMIN}/planes/nuevo`);
  await page.getByLabel(/^Clave/).fill("e2e-malo");
  await page.getByLabel("Nombre").fill("Sin precio");
  await page.getByRole("button", { name: "Crear plan" }).click();
  await expect(page.getByRole("alert").getByText(/Define al menos un precio/)).toBeVisible();
});
