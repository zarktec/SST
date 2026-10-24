import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { TENANT, resetState, openModal } from "./helpers";

test.beforeEach(async () => {
  await resetState();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query("UPDATE tenant SET workers_count = 12, risk_class = 1 WHERE slug = 'demo'");
  await pool.end();
});

test("elección electrónica del COPASST: candidatos, voto secreto con enlace personal, escrutinio y conformación", async ({
  page,
  browser,
}) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);

  // Personal por carga masiva
  await page.goto(`${TENANT}/personas`);
  await page.waitForLoadState("load");
  const importDlg = await openModal(page, "Carga masiva");
  const csv = [
    "vinculacion,tipo_documento,documento,nombre,fecha_ingreso",
    ...["Ana", "Beto", "Carla", "Diego", "Elena", "Fabio"].map(
      (n, i) => `Empleado,CC,${2000000000 + i},${n} Prueba,2024-01-01`,
    ),
  ].join("\n");
  await importDlg
    .getByLabel(/Archivo CSV/)
    .setInputFiles({ name: "p.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await importDlg.getByRole("button", { name: "Importar" }).click();
  await expect(page.getByText("Importadas: 6.")).toBeVisible();

  // Convocatoria
  await page.goto(`${TENANT}/comites`);
  await page.waitForLoadState("load");
  const electionDlg = await openModal(page, "Convocar elección");
  await electionDlg.getByLabel("Cierre de la votación").fill("2099-12-31");
  await electionDlg.getByRole("button", { name: "Convocar elección" }).click();
  await page.waitForURL(/\/comites\/elecciones\//);
  await page.waitForLoadState("load");

  // Candidatos
  let dlg = await openModal(page, "Inscribir candidato");
  await dlg.getByRole("button", { name: "Inscribir a Ana Prueba" }).click();
  await expect(page.getByRole("heading", { name: "Candidatos (1)" })).toBeVisible();
  await dlg.getByRole("button", { name: "Inscribir a Beto Prueba" }).click();
  await expect(page.getByRole("heading", { name: "Candidatos (2)" })).toBeVisible();
  await page.reload();
  await page.waitForLoadState("load");

  // Abrir votación y descargar enlaces
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cerrar inscripción y abrir votación" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Descargar enlaces (CSV)" }).click(),
  ]);
  const links = readFileSync((await download.path())!, "utf8")
    .split("\r\n")
    .slice(1)
    .map((l) => l.split('","').pop()!.replace(/"$/, ""));
  expect(links.length).toBe(6); // un enlace por trabajador activo

  // Tres personas votan sin iniciar sesión
  for (const [i, who] of [
    [0, "Ana Prueba"],
    [1, "Ana Prueba"],
    [2, "Beto Prueba"],
  ] as const) {
    const ctx = await browser.newContext();
    const phone = await ctx.newPage();
    await phone.goto(links[i]);
    await phone.waitForLoadState("load");
    await phone.getByLabel(who).check();
    phone.once("dialog", (d) => d.accept());
    await phone.getByRole("button", { name: "Votar" }).click();
    await expect(phone.getByText("Tu voto quedó registrado")).toBeVisible();
    await ctx.close();
  }
  // El mismo enlace no vota dos veces
  const again = await browser.newContext();
  const p2 = await again.newPage();
  await p2.goto(links[0]);
  await expect(p2.getByText("Ya votaste en esta elección")).toBeVisible();
  await again.close();

  // Escrutinio
  await page.reload();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Cerrar votación y escrutar" }).click();
  await expect(page.getByText(/3 votos emitidos/)).toBeVisible();
  await expect(page.getByText("Ana Prueba · 2 votos")).toBeVisible();

  // Conformación con representante del empleador
  dlg = await openModal(page, "Conformar el comité con el resultado");
  await dlg.getByLabel("Principal del empleador: Elena Prueba").check();
  await dlg.getByRole("button", { name: "Conformar el comité con el resultado" }).click();
  await expect(page.getByText("El comité ya fue conformado con este resultado.")).toBeVisible();
});
