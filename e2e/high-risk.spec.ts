import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("permiso de alturas: bloqueos por certificados y separación de funciones", async ({
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

  await page.goto(`${TENANT}/alto-riesgo`);
  await page.waitForLoadState("load");
  await page.getByRole("button", { name: "Crear los tipos predeterminados" }).click();
  await expect(page.getByRole("link", { name: "Trabajo en alturas" })).toBeVisible();
  await page.getByRole("link", { name: "Trabajo en alturas" }).click();
  await page.waitForLoadState("load");

  await page.locator("#rq-place").fill("Fachada norte");
  await page.locator("#rq-description").fill("Pintura de la fachada con andamio");
  for (const sel of await page.locator('select[id^="rq-c_"]').all()) await sel.selectOption("ok");
  await page.locator("#rq-coordinatorWorkerId").selectOption({ label: "Ana Pérez" });
  await page.locator("#rq-rescuePlan").fill("Rescate con la brigada y camilla");
  await page.getByLabel("Trabaja: Ana Pérez").check();
  const canvas = page.getByLabel("Área para firmar");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 40);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++)
    await page.mouse.move(box.x + 20 + i * 12, box.y + 40 + (i % 3) * 25);
  await page.mouse.up();
  await page.getByRole("button", { name: "Solicitar permiso" }).click();
  await expect(page.getByText("Pendiente de autorizar").first()).toBeVisible();
  await expect(page.getByText("Ana Pérez no tiene certificado de alturas vigente")).toBeVisible();
  await expect(
    page.getByText("El coordinador no tiene certificado de coordinador vigente"),
  ).toBeVisible();

  await page.locator("summary", { hasText: "Registrar certificado" }).click();
  await page.locator("#ce-issuer").fill("SENA");
  await page.locator("#ce-expiresOn").fill("2999-01-01");
  await page.getByRole("button", { name: "Registrar certificado" }).click();
  await expect(page.getByText("Autorizado", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Ana Pérez no tiene certificado de alturas vigente")).toHaveCount(0);
  // Quien solicita no puede autorizar su propio permiso.
  await expect(page.locator("summary", { hasText: "Autorizar con mi firma" })).toHaveCount(0);
});
