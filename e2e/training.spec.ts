import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("capacitación: sesión con QR, firma desde el celular sin sesión y certificado PDF", async ({
  page,
  browser,
}) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(`${TENANT}/`);

  // Persona
  await page.goto(`${TENANT}/personas/nuevo`);
  await page.waitForLoadState("load");
  await page.getByLabel("Número de documento").fill("1032456789");
  await page.getByLabel("Nombre completo").fill("Ana Pérez");
  await page.getByLabel("Fecha de ingreso").fill("2024-03-01");
  await page.getByRole("button", { name: "Registrar" }).click();
  await expect(page.getByText("Persona registrada.")).toBeVisible();

  // Curso con evaluación
  await page.goto(`${TENANT}/capacitacion/cursos`);
  await page.waitForLoadState("load");
  await page.getByLabel("Nombre del curso").fill("Inducción SST");
  await page.getByLabel(/Puntaje mínimo/).fill("70");
  await page.getByRole("button", { name: "Crear curso" }).click();
  await expect(page.getByText("Curso guardado.")).toBeVisible();
  await page.getByText("Editar").click();
  await page
    .getByLabel(/Evaluación \(una pregunta/)
    .fill("¿Qué es un EPP?\n* Elemento de protección personal\nUn juego");
  await page.getByRole("button", { name: "Guardar evaluación" }).click();
  await expect(page.getByText("Evaluación guardada (1 preguntas).")).toBeVisible();

  // Sesión
  await page.goto(`${TENANT}/capacitacion`);
  await page.waitForLoadState("load");
  await page.getByLabel("Fecha").fill(new Date().toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Programar sesión" }).click();
  await expect(page.getByText("Sesión programada.")).toBeVisible();
  await page
    .getByRole("link", { name: /Inducción SST/ })
    .first()
    .click();
  await page.waitForLoadState("load");
  await page.getByRole("button", { name: /Abrir sesión/ }).click();
  const qr = page.getByAltText("Código QR de asistencia");
  await expect(qr).toBeVisible();
  const url = (await page.locator("p.break-all").first().textContent())!.trim();
  expect(url).toContain("/asistencia/");

  // Asistente (sin sesión iniciada)
  const ctx = await browser.newContext();
  const phone = await ctx.newPage();
  await phone.goto(url);
  await expect(phone.getByText("Registro de asistencia")).toBeVisible();
  await phone.waitForLoadState("load");
  await phone.getByLabel("Número de documento").fill("1032456789");
  await phone.getByLabel("Elemento de protección personal").check();
  const canvas = phone.getByLabel("Área para firmar");
  const box = (await canvas.boundingBox())!;
  await phone.mouse.move(box.x + 20, box.y + 40);
  await phone.mouse.down();
  for (let i = 1; i <= 12; i++)
    await phone.mouse.move(box.x + 20 + i * 12, box.y + 40 + (i % 3) * 25);
  await phone.mouse.up();
  await phone.getByRole("button", { name: "Registrar mi asistencia" }).click();
  await expect(phone.getByText(/Asistencia registrada, Ana Pérez/)).toBeVisible();
  await ctx.close();

  // Vuelve el capacitador: ve al asistente y descarga el certificado
  await page.reload();
  await expect(page.getByText("Ana Pérez")).toBeVisible();
  const cert = await page.getByRole("link", { name: "Certificado" }).getAttribute("href");
  // El cliente HTTP de Node no resuelve *.localhost: se descarga desde el navegador.
  const head = await page.evaluate(async (href) => {
    const r = await fetch(href);
    const buf = new Uint8Array(await r.arrayBuffer());
    return { type: r.headers.get("content-type"), magic: String.fromCharCode(...buf.slice(0, 5)) };
  }, cert!);
  expect(head.type).toContain("application/pdf");
  expect(head.magic).toBe("%PDF-");
});
