import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("documentos: política en borrador, aprobación por otra persona con firma y nueva versión", async ({
  page,
}) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(`${TENANT}/`);
  await page.goto(`${TENANT}/documentos`);
  await page.waitForLoadState("load");
  await expect(page.getByText(/Aún no hay una política de SST aprobada/)).toBeVisible();

  await page.locator("#nd-code").fill("POL-001");
  await page.locator("#nd-title").fill("Política de seguridad y salud en el trabajo");
  await page.locator("#nd-kind").selectOption("policy");
  await page
    .locator("#nd-body")
    .fill("La empresa se compromete a proteger la seguridad y la salud de todos sus trabajadores.");
  await page.getByRole("button", { name: "Crear documento" }).click();
  await expect(page.getByText("Borrador v1")).toBeVisible();
  // Quien redacta no puede aprobar su propio documento.
  await expect(
    page.getByText("Otra persona con permiso de aprobación debe aprobar tu borrador."),
  ).toBeVisible();

  // Simula que lo redactó otra persona.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(
    "UPDATE document_version SET created_by = 'otro-usuario', created_by_name = 'Otra Persona'",
  );
  await pool.end();
  await page.reload();
  await page.locator("summary", { hasText: "Aprobar el borrador v1" }).click();
  const canvas = page.getByLabel("Área para firmar");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 40);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++)
    await page.mouse.move(box.x + 20 + i * 12, box.y + 40 + (i % 3) * 25);
  await page.mouse.up();
  await page.getByRole("button", { name: "Aprobar con mi firma" }).click();
  await expect(page.getByText(/v1 · vigente desde/)).toBeVisible();
  await expect(page.getByText(/Aún no hay una política de SST aprobada/)).toHaveCount(0);

  await page.locator("summary", { hasText: "Crear una nueva versión" }).click();
  await page
    .locator('[id^="dr-"][id$="-body"]')
    .fill("Texto actualizado de la política de seguridad y salud en el trabajo.");
  await page.getByRole("button", { name: "Crear nueva versión" }).click();
  await expect(page.getByText("Borrador v2")).toBeVisible();
});
