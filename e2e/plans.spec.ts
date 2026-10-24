import { expect, test } from "@playwright/test";
import { ADMIN, loginAdminWith2fa, openModal, resetState } from "./helpers";

test.beforeEach(resetState);

test("SUPER ADMIN crea y edita un plan con IVA configurable y crea un cupón", async ({
  page,
}, info) => {
  await loginAdminWith2fa(page);
  await page.goto(`${ADMIN}/planes`);
  const dlg = await openModal(page, "Nuevo plan");
  await dlg.getByLabel(/^Clave/).fill("e2e-plan");
  await dlg.getByLabel("Nombre").fill("Plan E2E");
  await dlg.getByLabel("Precio mensual (COP)").fill("200000");
  await dlg.getByLabel("Precio anual (COP)").fill("2000000");

  // Vista previa en vivo: IVA aparte 19 % → total $238.000
  await expect(dlg.getByText(/Mensual: neto .*200\.000.*total .*238\.000/)).toBeVisible();
  // IVA incluido: neto 168.067 + IVA 31.933 = 200.000
  await dlg.getByLabel("El precio ya incluye IVA").check();
  await expect(dlg.getByText(/Mensual: neto .*168\.067.*total .*200\.000/)).toBeVisible();
  await dlg.getByLabel("El precio ya incluye IVA").uncheck();

  await dlg.getByRole("button", { name: "Crear plan" }).click();
  await expect(page.getByRole("heading", { name: "Plan E2E" })).toBeVisible();

  // Edita el precio mensual y quita el anual
  const edit = await openModal(page, "Editar plan");
  await edit.getByLabel("Precio mensual (COP)").fill("250000");
  await edit.getByLabel("Precio anual (COP)").fill("");
  await edit.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText(/Plan guardado/)).toBeVisible();

  await page.goto(`${ADMIN}/planes`);
  await expect(page.getByText("Plan E2E")).toBeVisible();
  await expect(page.getByText(/297\.500/)).toBeVisible(); // 250.000 + 19 %
  await page.screenshot({ path: `test-results/plans-${info.project.name}.png`, fullPage: true });

  // Cupón
  await page.goto(`${ADMIN}/cupones`);
  const coupon = await openModal(page, "Nuevo cupón");
  await coupon.getByLabel("Código").fill("e2e10");
  await coupon.getByLabel(/^Valor/).fill("10");
  await coupon.getByRole("button", { name: "Crear cupón" }).click();
  await expect(page.getByText("Cupón E2E10 creado.")).toBeVisible();
  await expect(page.getByText("E2E10").first()).toBeVisible();
  // Duplicado
  const dup = await openModal(page, "Nuevo cupón");
  await dup.getByLabel("Código").fill("E2E10");
  await dup.getByLabel(/^Valor/).fill("5");
  await dup.getByRole("button", { name: "Crear cupón" }).click();
  await expect(page.getByText(/Ya existe un cupón/)).toBeVisible();
});

test("validaciones del formulario de planes", async ({ page }) => {
  await loginAdminWith2fa(page);
  await page.goto(`${ADMIN}/planes`);
  const dlg = await openModal(page, "Nuevo plan");
  await dlg.getByLabel(/^Clave/).fill("e2e-malo");
  await dlg.getByLabel("Nombre").fill("Sin precio");
  await dlg.getByRole("button", { name: "Crear plan" }).click();
  await expect(dlg.getByRole("alert").getByText(/Define al menos un precio/)).toBeVisible();
});
