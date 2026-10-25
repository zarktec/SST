import { expect, type Page } from "@playwright/test";
import { openModal } from "../e2e/helpers";
import { TENANT } from "./types";

/** Registra una persona (sin grabar) para escenarios que la necesitan. */
export async function createWorker(
  page: Page,
  w: { doc: string; name: string; position?: string; email?: string; start?: string },
) {
  await page.goto(`${TENANT}/personas`);
  await page.waitForLoadState("load");
  const dlg = await openModal(page, "Registrar");
  await dlg.getByLabel("Número de documento").fill(w.doc);
  await dlg.getByLabel("Nombre completo").fill(w.name);
  if (w.position) await dlg.getByLabel("Cargo").fill(w.position);
  await dlg.getByLabel("Fecha de ingreso").fill(w.start ?? "2024-03-01");
  if (w.email) await dlg.getByLabel("Correo", { exact: true }).fill(w.email);
  await dlg.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect(page.getByText("Persona registrada.")).toBeVisible();
}

/** Crea una acción vencida (sin grabar). */
export async function createAction(
  page: Page,
  title: string,
  due = "2030-01-01",
  who = "Luis Gómez",
) {
  await page.goto(`${TENANT}/acciones`);
  await page.waitForLoadState("load");
  const dlg = await openModal(page, "Nueva acción");
  await dlg.getByLabel("Acción", { exact: true }).fill(title);
  await dlg.getByLabel("Responsable").fill(who);
  await dlg.getByLabel("Fecha límite").fill(due);
  await dlg.getByRole("button", { name: "Crear acción" }).click();
  await expect(page.getByText("Acción creada.")).toBeVisible();
}

/** Importa personas por CSV (sin grabar). */
export async function importPeople(page: Page, names: string[]) {
  await page.goto(`${TENANT}/personas`);
  await page.waitForLoadState("load");
  const dlg = await openModal(page, "Carga masiva");
  const csv = [
    "vinculacion,tipo_documento,documento,nombre,fecha_ingreso",
    ...names.map((n, i) => `Trabajador,CC,${2000000000 + i},${n},2024-01-01`),
  ].join("\n");
  await dlg
    .getByLabel(/Archivo CSV/)
    .setInputFiles({ name: "p.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await dlg.getByRole("button", { name: "Importar" }).click();
  await expect(page.getByText(`Importadas: ${names.length}.`)).toBeVisible();
}
