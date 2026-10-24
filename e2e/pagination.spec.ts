import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("listas largas: paginación por enlaces, estable y accesible", async ({ page }) => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(
    `INSERT INTO corrective_action (id, tenant_id, type, source, title, responsible_name, due_date, status)
     SELECT gen_random_uuid(), (SELECT id FROM tenant WHERE slug = 'demo'), 'corrective', 'manual',
            'Acción de prueba ' || lpad(g::text, 3, '0'), 'Ana', date '2030-01-01' + g, 'open'
     FROM generate_series(1, 30) g`,
  );
  await pool.end();
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);

  await page.goto(`${TENANT}/acciones`);
  await expect(page.getByText("Página 1 de 2 · 30 registros")).toBeVisible();
  await expect(page.getByRole("link", { name: /Acción de prueba/ })).toHaveCount(25);
  await expect(page.getByRole("link", { name: /Acción de prueba 001/ })).toBeVisible();
  await expect(page.getByText("← Anterior")).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("link", { name: "Siguiente →" }).click();
  await expect(page).toHaveURL(/p=2/);
  await expect(page.getByText("Página 2 de 2 · 30 registros")).toBeVisible();
  await expect(page.getByRole("link", { name: /Acción de prueba/ })).toHaveCount(5);
  await expect(page.getByRole("link", { name: /Acción de prueba 030/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Acción de prueba 001/ })).toHaveCount(0);
  // Un número de página inválido cae en la primera.
  await page.goto(`${TENANT}/acciones?p=abc`);
  await expect(page.getByText("Página 1 de 2 · 30 registros")).toBeVisible();
});
