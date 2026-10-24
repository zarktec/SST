import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// Navegador: CHROMIUM_PATH, el preinstalado del entorno de desarrollo o el que instala `playwright install` (CI).
const preinstalled = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const chromium = process.env.CHROMIUM_PATH || (existsSync(preinstalled) ? preinstalled : undefined);

/**
 * E2E contra `next start` (requiere `pnpm build`, BD migrada y seed con la empresa demo).
 * Hosts de prueba: *.localhost resuelve a loopback en Chromium (demo.localhost, admin.localhost…).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  retries: process.env.CI ? 1 : 0,
  use: { launchOptions: chromium ? { executablePath: chromium } : {}, trace: "retain-on-failure" },
  projects: [
    {
      name: "mobile-375",
      use: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true },
    },
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000/offline",
    reuseExistingServer: true,
    timeout: 60_000,
    // El barrido diario (cron) se invoca en pruebas con este secreto.
    env: { CRON_SECRET: "e2e-cron-secret" },
  },
});
