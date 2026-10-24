import { expect, test } from "@playwright/test";
import { TENANT, openModal, resetState } from "./helpers";

test.beforeEach(resetState);

test("accidente grave: reporte ARL, investigación con equipo y cierre con plan de acción", async ({
  page,
}) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
  await page.goto(`${TENANT}/accidentes`);
  await page.waitForLoadState("load");
  let dlg = await openModal(page, "Reportar evento");
  await dlg.getByLabel("Gravedad").selectOption("serious");
  await dlg.getByLabel(/Nombre de la persona afectada/).fill("Pedro Pérez");
  await dlg.getByLabel("Lugar").fill("Bodega 2");
  await dlg.getByLabel("¿Qué pasó?").fill("Caída desde una escalera al alcanzar una caja");
  await dlg.getByRole("button", { name: "Reportar evento" }).click();
  await expect(page.getByRole("link", { name: /Accidente · Pedro Pérez/ })).toBeVisible();
  await page.getByRole("link", { name: /Accidente · Pedro Pérez/ }).click();
  await page.waitForLoadState("load");
  await expect(page.getByText(/días hábiles|Vence hoy/)).toBeVisible();
  dlg = await openModal(page, "Registrar reporte");
  await dlg.getByRole("button", { name: "Registrar reporte" }).click();
  await expect(page.getByText(/Reportado/).first()).toBeVisible();

  await page.getByRole("button", { name: "Abrir investigación" }).click();
  await expect(page.getByRole("button", { name: "Registrar investigación" })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cerrar investigación" }).click();
  await expect(page.getByText(/Falta el representante del COPASST/)).toBeVisible();

  dlg = await openModal(page, "Registrar investigación");
  await dlg.getByLabel("Jefe inmediato o supervisor").fill("Ana Ruiz");
  await dlg.getByLabel(/Representante del COPASST/).fill("Luis Gómez");
  await dlg.getByLabel("Responsable del SG-SST").fill("Marta Díaz");
  await dlg.getByLabel(/Profesional con licencia/).fill("Carlos Soto");
  await dlg.getByLabel(/^Análisis/).fill("Cayó\nEscalera inestable\nSin mantenimiento");
  await dlg.getByLabel(/Causas inmediatas/).fill("Escalera sin apoyo");
  await dlg.getByLabel(/Causas básicas/).fill("Sin inspección periódica");
  await dlg.getByRole("button", { name: "Guardar investigación" }).click();
  dlg = await openModal(page, "Registrar investigación");
  await expect(dlg.getByLabel(/Causas inmediatas/)).toHaveValue("Escalera sin apoyo");
  await dlg.getByRole("button", { name: "Cerrar" }).click();

  dlg = await openModal(page, "Agregar acción");
  await dlg.getByLabel("Acción", { exact: true }).fill("Inspeccionar las escaleras");
  await dlg.getByLabel("Responsable", { exact: true }).fill("Ana Ruiz");
  await dlg.getByLabel("Fecha límite").fill("2030-01-01");
  await dlg.getByRole("button", { name: "Agregar al plan de acción" }).click();
  await expect(page.getByRole("link", { name: "Inspeccionar las escaleras" })).toBeVisible();

  dlg = await openModal(page, "Remitir a la ARL");
  await dlg.getByRole("button", { name: "Registrar remisión" }).click();
  await expect(page.getByText(/Remitida el/)).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cerrar investigación" }).click();
  await expect(page.getByText("Cerrada")).toBeVisible();
});
