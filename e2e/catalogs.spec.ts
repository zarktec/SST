import { expect, test } from "@playwright/test";
import { ADMIN, loginAdminWith2fa, resetState } from "./helpers";

test.beforeEach(resetState);

test("SUPER ADMIN versiona un catálogo: borrador, importación CSV, validación y publicación inmutable", async ({
  page,
}, info) => {
  await loginAdminWith2fa(page);
  await page.goto(`${ADMIN}/catalogos`);
  await expect(page.getByRole("heading", { name: "Catálogos normativos" })).toBeVisible();
  // Los parámetros sembrados están vigentes y marcados como pendientes de validar por un experto
  await page.getByRole("link", { name: /Parámetros normativos/ }).click();
  await expect(page.getByText(/Versión 1/)).toBeVisible();
  await page.getByRole("link", { name: /Versión 1/ }).click();
  await expect(page.getByText("at.reporte_arl_dias_habiles", { exact: true })).toBeVisible();
  await expect(page.getByText("Pendiente de validar").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Guardar elemento" })).toHaveCount(0); // publicada: no editable

  // Catálogo vacío: crear borrador e importar CSV con una fila inválida
  await page.goto(`${ADMIN}/catalogos/hazard_catalog`);
  await page.getByRole("button", { name: /Crear borrador/ }).click();
  await expect(page.getByRole("heading", { name: /Versión 1/ })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const csv =
    "family,hazard,description\nFísico,Ruido,Exposición a ruido continuo\nQuímico,Polvo,\n,SinFamilia,x\n";
  await page
    .getByLabel("Archivo")
    .setInputFiles({ name: "peligros.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await page.getByRole("button", { name: "Importar" }).click();
  await expect(page.getByText(/Importadas 2 filas\. 1 con errores/)).toBeVisible();
  await expect(page.getByText(/Fila 3/)).toBeVisible();
  await expect(page.getByText("físico:ruido", { exact: true })).toBeVisible();

  // Agregar un elemento a mano (y uno inválido)
  await page.getByLabel("Elemento en JSON").fill('{"family":"Biológico","hazard":"Virus"}');
  await page.getByRole("button", { name: "Guardar elemento" }).click();
  await expect(page.getByText(/Guardado: biológico:virus/)).toBeVisible();
  await page.getByLabel("Elemento en JSON").fill('{"family":"X"}');
  await page.getByRole("button", { name: "Guardar elemento" }).click();
  await expect(page.getByRole("alert").getByText(/family/)).toBeVisible();

  // Publicar exige norma fuente; luego la versión queda inmutable
  await page.getByLabel("Vigente desde").fill("2026-01-01");
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText(/norma fuente/i).first()).toBeVisible();
  await page.getByLabel("Norma fuente").fill("GTC 45");
  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Vigente").first()).toBeVisible();
  await page.getByRole("link", { name: /Versión 1/ }).click();
  await expect(page.getByRole("button", { name: "Guardar elemento" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Eliminar" })).toHaveCount(0);
  await page.screenshot({ path: `test-results/catalogs-${info.project.name}.png`, fullPage: true });
});
