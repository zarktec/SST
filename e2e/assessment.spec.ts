import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";
import { TENANT, resetState, seedStandardsCatalog } from "./helpers";

test.beforeEach(async () => {
  await resetState();
  await seedStandardsCatalog();
  // La empresa demo ya está clasificada (7 estándares) para esta prueba.
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query("UPDATE tenant SET standards_group = 7 WHERE slug = 'demo'");
  await pool.end();
});

async function login(page: Page) {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(`${TENANT}/`);
}

test("autoevaluación: calificar, cerrar, plan de mejoramiento", async ({ page }) => {
  await login(page);
  await page.goto(`${TENANT}/estandares`);
  await page.waitForLoadState("load");
  await page.getByRole("button", { name: /Iniciar autoevaluación/ }).click();
  await expect(page.getByRole("heading", { name: /^Autoevaluación \d{4}$/ })).toBeVisible();
  await page.waitForLoadState("load");

  await page.getByRole("button", { name: "Cerrar autoevaluación" }).click(); // diálogo de confirmación
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cerrar autoevaluación" }).click();
  await expect(page.getByText(/Faltan 2 ítems por calificar/)).toBeVisible();

  const forms = page.locator("form").filter({ hasText: "Criterio 1.1.1" });
  await forms.locator('select[name="status"]').selectOption("cumple");
  await forms.getByRole("button", { name: "Guardar ítem" }).click();
  await expect(forms.getByText("Guardado.")).toBeVisible();
  const f2 = page.locator("form").filter({ hasText: "Criterio 1.1.2" });
  await f2.locator('select[name="status"]').selectOption("no_cumple");
  await f2.getByRole("button", { name: "Guardar ítem" }).click();
  await expect(f2.getByText("Guardado.")).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cerrar autoevaluación" }).click();
  await expect(page.getByText(/40\.00%/)).toBeVisible();
  await expect(page.getByText(/2 de 2 ítems calificados.*cerrada/)).toBeVisible();

  await page.goto(`${TENANT}/estandares/plan`);
  await expect(page.getByText("Cumplir: Criterio 1.1.2")).toBeVisible();
  await expect(page.getByText("1 acciones abiertas")).toBeVisible();
});
