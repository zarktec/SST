import { expect, test } from "@playwright/test";
import { ADMIN, TENANT, resetState } from "./helpers";

test.beforeEach(resetState);

test("encabezados de seguridad y CSP con nonce distinto por solicitud", async ({ page }) => {
  const r1 = await page.goto(`${TENANT}/login`);
  const h = r1!.headers();
  const csp = h["content-security-policy"];
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(csp).not.toMatch(/script-src[^;]*unsafe-(inline|eval)/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  const r2 = await page.goto(`${TENANT}/login`);
  const n = (v: string) => /'nonce-([^']+)'/.exec(v)![1];
  expect(n(r2!.headers()["content-security-policy"])).not.toBe(n(csp));
});

test("las páginas principales no violan la CSP (sin scripts en línea bloqueados)", async ({
  page,
}) => {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (/content security policy|refused to (execute|load|apply)/i.test(m.text()))
      problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(e.message));
  await page.goto(`${TENANT}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Correo electrónico").fill("demo@demo.test");
  await page.getByLabel("Contraseña").fill("DemoClave-2026!");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL(`${TENANT}/`);
  for (const path of [
    "/",
    "/acciones",
    "/informes",
    "/documentos",
    "/notificaciones",
    "/facturacion",
    "/offline",
  ]) {
    await page.goto(`${TENANT}${path}`);
    await page.waitForLoadState("networkidle");
  }
  await page.goto(`${ADMIN}/login`);
  await page.waitForLoadState("networkidle");
  // El tema (script en línea con nonce) se aplicó: el atributo existe.
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toMatch(/light|dark/);
  expect(problems).toEqual([]);
});

test("sin sesión no se accede a datos ni a descargas, y el cron exige su secreto", async ({
  page,
}) => {
  await page.goto(`${TENANT}/login`);
  const probe = (path: string, init?: RequestInit) =>
    page.evaluate(
      async ([p, i]) => {
        const r = await fetch(p as string, { redirect: "manual", ...(i as RequestInit) });
        return { status: r.status, type: r.type, ct: r.headers.get("content-type") ?? "" };
      },
      [path, init ?? {}] as const,
    );
  for (const path of [
    "/informes/acciones/pdf",
    "/informes/carpeta-inspeccion",
    "/informes/exportacion-total",
    "/calendario/ics",
  ]) {
    const r = await probe(path);
    expect(["opaqueredirect"].includes(r.type) || r.status >= 300, path).toBe(true);
    expect(r.ct, path).not.toMatch(/pdf|zip|calendar|spreadsheet/);
  }
  const sync = await probe("/api/inspecciones/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  expect(sync.type === "opaqueredirect" || sync.status >= 300).toBe(true);
  expect((await probe("/api/cron/daily")).status).toBe(401);
  expect(
    (await probe("/api/cron/daily", { headers: { authorization: "Bearer mal" } })).status,
  ).toBe(401);
  // Las carpetas internas del enrutador no se alcanzan directamente.
  expect((await probe("/tenant/acciones")).status).toBe(404);
});
