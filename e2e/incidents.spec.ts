import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("accidente grave: reporte ARL, investigación con equipo y cierre con plan de acción", async ({
  page,
}) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(`${TENANT}/`);
  await page.goto(`${TENANT}/accidentes`);
  await page.waitForLoadState("load");
  await page.getByLabel("Gravedad").selectOption("serious");
  await page.getByLabel(/Nombre de la persona afectada/).fill("Pedro Pérez");
  await page.getByLabel("Lugar").fill("Bodega 2");
  await page.getByLabel("¿Qué pasó?").fill("Caída desde una escalera al alcanzar una caja");
  await page.getByRole("button", { name: "Reportar evento" }).click();
  await expect(page.getByRole("link", { name: /Accidente · Pedro Pérez/ })).toBeVisible();
  await page.getByRole("link", { name: /Accidente · Pedro Pérez/ }).click();
  await page.waitForLoadState("load");
  await expect(page.getByText(/días hábiles|Vence hoy/)).toBeVisible();
  await page.getByRole("button", { name: "Registrar reporte" }).click();
  await expect(page.getByText(/Reportado/).first()).toBeVisible();

  await page.getByRole("button", { name: "Abrir investigación" }).click();
  await expect(page.getByRole("button", { name: "Guardar investigación" })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cerrar investigación" }).click();
  await expect(page.getByText(/Falta el representante del COPASST/)).toBeVisible();

  await page.getByLabel("Jefe inmediato o supervisor").fill("Ana Ruiz");
  await page.getByLabel(/Representante del COPASST/).fill("Luis Gómez");
  await page.getByLabel("Responsable del SG-SST").fill("Marta Díaz");
  await page.getByLabel(/Profesional con licencia/).fill("Carlos Soto");
  await page.getByLabel(/^Análisis/).fill("Cayó\nEscalera inestable\nSin mantenimiento");
  await page.getByLabel(/Causas inmediatas/).fill("Escalera sin apoyo");
  await page.getByLabel(/Causas básicas/).fill("Sin inspección periódica");
  await page.getByRole("button", { name: "Guardar investigación" }).click();
  await expect(page.getByLabel(/Causas inmediatas/)).toHaveValue("Escalera sin apoyo");

  await page.getByLabel("Acción", { exact: true }).fill("Inspeccionar las escaleras");
  await page.getByLabel("Responsable", { exact: true }).fill("Ana Ruiz");
  await page.getByLabel("Fecha límite").fill("2030-01-01");
  await page.getByRole("button", { name: "Agregar al plan de acción" }).click();
  await expect(page.getByRole("link", { name: "Inspeccionar las escaleras" })).toBeVisible();

  await page.getByRole("button", { name: "Registrar remisión" }).click();
  await expect(page.getByText(/Remitida el/)).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cerrar investigación" }).click();
  await expect(page.getByText("Cerrada")).toBeVisible();
});
