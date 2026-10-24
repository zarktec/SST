import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

async function login(page: import("@playwright/test").Page) {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
}

test("auditoría interna: ejecutar, cerrar y convertir hallazgos en acciones", async ({ page }) => {
  await login(page);
  await page.goto(`${TENANT}/auditorias`);
  await page.waitForLoadState("load");
  await expect(page.getByText(/No hay auditoría programada/)).toBeVisible();
  await page.locator("#na-title").fill("Auditoría anual del SG-SST");
  await page.locator("#na-itemsText").fill("Política divulgada\nActas del COPASST al día");
  await page.getByRole("button", { name: "Programar auditoría" }).click();
  await expect(page.getByRole("heading", { name: "Auditoría anual del SG-SST" })).toBeVisible();

  await page.locator("summary", { hasText: "Ejecutar la auditoría" }).click();
  await page.locator('[id^="ex-"][id$="-auditorName"]').fill("Marta Díaz");
  await page.locator('[id^="ex-"][id$="-committeeParticipant"]').fill("Luis Gómez");
  await page.locator('[id^="ex-"][id$="-r_a1"]').selectOption("conforms");
  await page.locator('[id^="ex-"][id$="-r_a2"]').selectOption("major_nc");
  await page.locator('[id^="ex-"][id$="-n_a2"]').fill("Faltan tres actas");
  await page
    .locator('[id^="ex-"][id$="-report"]')
    .fill("El sistema cumple parcialmente los requisitos evaluados");
  await page.getByRole("button", { name: "Guardar avance" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cerrar auditoría" }).click();
  await expect(page.getByText("Cerrada", { exact: true })).toBeVisible();

  await page.goto(`${TENANT}/acciones`);
  await expect(page.getByText(/NC mayor de auditoría: Actas del COPASST/)).toBeVisible();
});

test("revisión por la dirección: entradas del sistema, conclusiones, firma y acciones", async ({
  page,
}) => {
  await login(page);
  await page.goto(`${TENANT}/revision-direccion`);
  await page.waitForLoadState("load");
  await page.locator("#nr-attendees").fill("Gerente general y responsable del SG-SST");
  await page.getByRole("button", { name: /Crear la revisión/ }).click();
  await expect(page.getByText("Entradas del sistema")).toBeVisible();
  await expect(page.getByText(/Accidentalidad \d{4}: 0 accidente/)).toBeVisible();

  await page
    .locator('[id^="rv-"][id$="-conclusions"]')
    .fill("El sistema es conveniente y adecuado pero requiere más recursos");
  await page.locator('[id^="rv-"][id$="-decisions"]').fill("Asignar presupuesto para capacitación");
  await page.getByRole("button", { name: "Guardar revisión" }).click();
  await expect(page.getByText("Revisión guardada.")).toBeVisible();

  await page.locator("summary", { hasText: "Firmar (alta dirección)" }).click();
  const canvas = page.getByLabel("Área para firmar");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 40);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++)
    await page.mouse.move(box.x + 20 + i * 12, box.y + 40 + (i % 3) * 25);
  await page.mouse.up();
  await page.getByRole("button", { name: "Firmar revisión" }).click();
  await expect(page.getByText("Firmada", { exact: true })).toBeVisible();

  await page.goto(`${TENANT}/acciones`);
  await expect(
    page.getByText(/Revisión por la dirección \d{4}: Asignar presupuesto/),
  ).toBeVisible();
});
