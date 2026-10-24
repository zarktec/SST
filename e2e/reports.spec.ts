import { expect, test } from "@playwright/test";
import { TENANT, openModal, resetState } from "./helpers";

test.beforeEach(resetState);

test("informes: descargas en PDF/Excel/CSV, carpeta de inspección y exportación total", async ({
  page,
}) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(TENANT);
  await page.goto(`${TENANT}/acciones`);
  await page.waitForLoadState("load");
  const dlg = await openModal(page, "Nueva acción");
  await dlg.getByLabel("Acción", { exact: true }).fill("Reparar la baranda de la escalera");
  await dlg.getByLabel("Responsable").fill("Luis Gómez");
  await dlg.getByLabel("Fecha límite").fill("2030-01-01");
  await dlg.getByRole("button", { name: "Crear acción" }).click();
  await expect(page.getByText("Acción creada.")).toBeVisible();

  await page.goto(`${TENANT}/informes`);
  await expect(page.getByRole("heading", { name: "Informes y exportaciones" })).toBeVisible();
  await expect(page.getByText("Acciones correctivas, preventivas y de mejora")).toBeVisible();

  // *.localhost no se resuelve desde Node: las descargas se piden desde la página (con su sesión).
  // La empresa vive bajo /{slug}: las rutas se piden con su base.
  const base = new URL(TENANT).pathname;
  const get = (path: string) =>
    page.evaluate(async (p) => {
      const r = await fetch(p);
      const buf = new Uint8Array(await r.arrayBuffer());
      return {
        status: r.status,
        type: r.headers.get("content-type") ?? "",
        size: buf.byteLength,
        head: String.fromCharCode(...buf.slice(0, 5)),
        text: (r.headers.get("content-type") ?? "").startsWith("text/")
          ? new TextDecoder().decode(buf)
          : "",
      };
    }, `${base}${path}`);

  const pdf = await get("/informes/acciones/pdf");
  expect(pdf).toMatchObject({ status: 200, head: "%PDF-" });
  expect(pdf.type).toContain("application/pdf");

  const xlsx = await get("/informes/acciones/xlsx");
  expect(xlsx.type).toContain("spreadsheetml");
  expect(xlsx.head.slice(0, 2)).toBe("PK");

  expect((await get("/informes/acciones/csv")).text).toContain("Reparar la baranda de la escalera");

  const folder = await get("/informes/carpeta-inspeccion");
  expect(folder.type).toContain("application/zip");
  expect(folder.size).toBeGreaterThan(5000);

  const all = await get("/informes/exportacion-total");
  expect(all.status).toBe(200);
  expect(all.head.slice(0, 2)).toBe("PK");

  expect((await get("/informes/no-existe/pdf")).status).toBe(404);
});
