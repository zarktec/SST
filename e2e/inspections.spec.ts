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

async function createTemplate(page: import("@playwright/test").Page) {
  await page.goto(`${TENANT}/inspecciones`);
  await page.waitForLoadState("load");
  await page.getByLabel("Nombre", { exact: true }).fill("Inspección locativa");
  await page.getByLabel("Categoría").fill("Locativa");
  await page
    .getByLabel(/Ítems \(uno por línea/)
    .fill("* Pisos secos y sin obstáculos\nSalidas de emergencia libres");
  await page.getByRole("button", { name: "Guardar plantilla" }).click();
  await expect(page.getByRole("link", { name: /Inspección locativa/ })).toBeVisible();
}

test("inspección en línea: hallazgo genera acción correctiva", async ({ page }) => {
  await login(page);
  await createTemplate(page);
  await page.getByRole("link", { name: /Inspección locativa/ }).click();
  await page.waitForLoadState("load");
  await page.getByLabel("Lugar").fill("Bodega 1");
  await page
    .getByRole("group", { name: "Pisos secos y sin obstáculos" })
    .getByRole("button", { name: "No cumple" })
    .click();
  await page.getByRole("button", { name: "Enviar inspección" }).click();
  await expect(page.getByText(/Describe el hallazgo/)).toBeVisible();
  await page.getByLabel(/Hallazgo: Pisos secos/).fill("Charco de agua en el pasillo");
  await page.getByRole("button", { name: "Enviar inspección" }).click();
  await page.waitForURL(`${TENANT}/inspecciones`);
  await page.locator('a[href^="/demo/inspecciones/"]:not([href*="ejecutar"])').first().click();
  await expect(page.getByText("Charco de agua en el pasillo")).toBeVisible();
  await expect(page.getByRole("link", { name: /Corregir hallazgo: Pisos secos/ })).toBeVisible();
});

test("inspección sin conexión: queda en cola y se sincroniza al reconectar", async ({
  page,
  context,
}) => {
  await login(page);
  await createTemplate(page);
  await page.getByRole("link", { name: /Inspección locativa/ }).click();
  await page.waitForLoadState("load");
  await page.getByLabel("Lugar").fill("Patio");
  await page
    .getByRole("group", { name: "Pisos secos y sin obstáculos" })
    .getByRole("button", { name: "Cumple", exact: true })
    .click();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Enviar inspección" }).click();
  await expect(page.getByText(/Sin conexión: la inspección quedó guardada/)).toBeVisible();
  await context.setOffline(false);
  // Al volver la red la cola se envía sola desde la pantalla donde está la persona (evento `online`). Se espera ese
  // envío antes de navegar: ir a la lista justo mientras responde el servidor deja la lista renderizada sin la fila.
  await expect(page.getByText(/1 inspección\(es\) sincronizada/)).toBeVisible();
  await page.goto(`${TENANT}/inspecciones`);
  await page.waitForLoadState("load");
  await expect(page.getByText("Sin hallazgos")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/pendiente\(s\) de enviar/)).toHaveCount(0);
});

test("la pantalla de inspección abre sin conexión tras visitarla en línea (service worker)", async ({
  page,
  context,
}) => {
  await login(page);
  await createTemplate(page);
  await page.getByRole("link", { name: /Inspección locativa/ }).click();
  await page.waitForLoadState("load");
  const url = page.url();
  // El service worker toma el control; al visitar la lista precarga la pantalla de ejecución en su caché.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.goto(`${TENANT}/inspecciones`);
  await page.waitForFunction(async () => {
    const keys = await (await caches.open("sst-pages-v2")).keys();
    return keys.length > 0;
  });
  await context.setOffline(true);
  await page.goto(url);
  await expect(page.getByRole("button", { name: "Enviar inspección" })).toBeVisible();
  await expect(page.getByLabel("Lugar")).toBeVisible();
  await context.setOffline(false);
});
