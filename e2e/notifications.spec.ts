import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("alertas: una acción vencida genera la alerta, se marca leída y aparece en el calendario .ics", async ({
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
  await page.getByLabel("Acción", { exact: true }).fill("Reparar la baranda de la escalera");
  await page.getByLabel("Responsable").fill("Luis Gómez");
  await page.getByLabel("Fecha límite").fill("2020-01-01");
  await page.getByRole("button", { name: "Crear acción" }).click();
  await expect(page.getByText("Acción creada.")).toBeVisible();

  // El barrido diario (cron) crea las notificaciones; aquí se invoca con el secreto del cron.
  const res = await page.evaluate(
    async ([url, secret]) =>
      (await fetch(`${url}/api/cron/daily`, { headers: { authorization: `Bearer ${secret}` } }))
        .status,
    [TENANT, "e2e-cron-secret"] as const,
  );
  expect(res).toBe(200);

  await page.goto(`${TENANT}/notificaciones`);
  await expect(page.getByText(/1 acción vencida/)).toBeVisible();
  await page.getByRole("button", { name: "Marcar todas como leídas" }).click();
  await expect(page.getByText("Nueva", { exact: true })).toHaveCount(0);

  await page.goto(`${TENANT}/calendario`);
  await expect(page.getByText(/Acción: Reparar la baranda/)).toBeVisible();
  const ics = await page.evaluate(
    async (u) => await (await fetch(`${u}/calendario/ics`)).text(),
    TENANT,
  );
  expect(ics).toContain("BEGIN:VCALENDAR");
  expect(ics).toContain("SUMMARY:Acción: Reparar la baranda de la escalera");
});
