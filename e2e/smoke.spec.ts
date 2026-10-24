import { expect, test, type Page } from "@playwright/test";
import { ADMIN, TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

/** El cliente HTTP de Node no resuelve *.localhost (el navegador sí): se envía el Host a mano. */
const viaHost = (host: string, path: string) => ({
  url: `http://127.0.0.1:3000${path}`,
  headers: { host },
});

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("login de empresa: marca, sin scroll horizontal y objetivos táctiles de 44px", async ({
  page,
}) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Accede a Empresa Demo")).toBeVisible();
  await noHorizontalScroll(page);
  for (const el of await page.locator("button, input, a").all()) {
    if (!(await el.isVisible())) continue;
    const box = await el.boundingBox();
    expect(box!.height, await el.innerText().catch(() => "")).toBeGreaterThanOrEqual(43.5);
  }
});

test("usuario de la empresa entra al panel y ve la navegación adecuada al viewport", async ({
  page,
}, info) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Hola, Ana" })).toBeVisible();
  await noHorizontalScroll(page);
  const navs = page.getByRole("navigation", { name: "Principal" });
  const visible = [];
  for (const n of await navs.all()) if (await n.isVisible()) visible.push(n);
  expect(visible).toHaveLength(1);
  const box = await visible[0].boundingBox();
  if (info.project.name === "mobile-375")
    expect(box!.y).toBeGreaterThan(600); // barra inferior
  else expect(box!.x).toBeLessThan(5); // barra lateral
  await page.screenshot({ path: `test-results/home-${info.project.name}.png` });
});

test("un usuario de empresa no entra al panel de plataforma", async ({ page }) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Hola, Ana" })).toBeVisible();
  // La sesión es host-only: en admin. no existe; y aunque inicie sesión no es personal de plataforma.
  await page.goto(`${ADMIN}/`);
  await expect(page).toHaveURL(/\/login/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/login\?error=forbidden/);
});

test("SUPER ADMIN sin 2FA es enviado a activarlo", async ({ page }, info) => {
  await page.goto(`${ADMIN}/`);
  await expect(page).toHaveURL(/\/login/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("admin@zark.pro");
  await page.getByLabel("Contraseña").fill("SuperClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/security\/2fa/);
  await expect(page.getByText("El 2FA es obligatorio")).toBeVisible();
  await page.screenshot({ path: `test-results/2fa-${info.project.name}.png` });
});

test("hosts y rutas internas", async ({ page, request }) => {
  const get = (host: string, path: string) => {
    const r = viaHost(host, path);
    return request.get(r.url, { headers: r.headers });
  };
  // Las empresas ya no usan subdominio: cualquier *.root es desconocido
  expect((await get("noexiste.localhost:3000", "/")).status()).toBe(404);
  expect((await get("demo.localhost:3000", "/")).status()).toBe(404);
  // Las carpetas internas no se exponen directamente (ni en la raíz ni bajo /{slug})
  expect((await get("localhost:3000", "/tenant/login")).status()).toBe(404);
  expect((await get("localhost:3000", "/platform")).status()).toBe(404);
  expect((await get("localhost:3000", "/demo/platform")).status()).toBe(404);
  // Una empresa que no existe cae en 404 y el login de marketing no existe
  expect((await get("localhost:3000", "/no-existe/login")).status()).toBe(404);
  expect((await get("localhost:3000", "/login")).status()).toBe(404);
  // La empresa demo responde en /demo/login
  expect((await get("localhost:3000", "/demo/login")).status()).toBe(200);
  // Cada host sirve su propia área
  await page.goto("http://localhost:3000/");
  await expect(page.getByRole("heading", { name: /SG-SST listo/ })).toBeVisible();
});

test("manifest PWA por empresa (con su ruta base como alcance)", async ({ request }) => {
  const res = await request.get("http://localhost:3000/demo/api/manifest");
  const m = await res.json();
  expect(m.name).toBe("Empresa Demo");
  expect(m.display).toBe("standalone");
  expect(m.start_url).toBe("/demo");
  expect(m.scope).toBe("/demo/");
  const icon = await request.get(`http://127.0.0.1:3000${m.icons[0].src}`);
  expect(icon.status()).toBe(200);
});

test("las empresas no ven la sesión de otra: /{slug} exige membresía en esa empresa", async ({
  page,
}) => {
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByRole("heading", { name: "Hola, Ana" })).toBeVisible();
  // Misma sesión (mismo origen), pero otra empresa inexistente: 404, nunca datos de demo
  const other = await page.goto("http://localhost:3000/otra-empresa/personas");
  expect(other?.status()).toBe(404);
  // Y la navegación interna conserva el prefijo /demo
  await page.goto(TENANT);
  await page.getByRole("link", { name: "Personas" }).first().click();
  await expect(page).toHaveURL(`${TENANT}/personas`);
});
