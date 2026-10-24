import { expect, test } from "@playwright/test";
import { TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("usuarios: invitar, revocar y proteger al único administrador", async ({ page }) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(`${TENANT}/`);

  await page.goto(`${TENANT}/usuarios`);
  await expect(page.getByRole("heading", { name: "Usuarios y roles" })).toBeVisible();
  await expect(page.getByText("(tú)")).toBeVisible();
  // El propio administrador no puede desactivarse ni cambiarse el rol desde la pantalla.
  await expect(page.getByRole("button", { name: "Desactivar" })).toHaveCount(0);

  await page.getByLabel("Correo", { exact: true }).fill("nuevo@demo.test");
  await page.getByRole("button", { name: "Enviar invitación" }).click();
  await expect(page.getByText("Invitación enviada.")).toBeVisible();
  const pending = page.getByRole("listitem").filter({ hasText: "nuevo@demo.test" });
  await expect(pending).toBeVisible();

  page.once("dialog", (d) => d.accept());
  await pending.getByRole("button", { name: "Revocar" }).click();
  await expect(page.getByText("nuevo@demo.test")).toHaveCount(0);
});
