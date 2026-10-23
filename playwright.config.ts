import { defineConfig } from "@playwright/test";

const chromium = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

/**
 * E2E contra `next start` (requiere `pnpm build`, BD migrada y seed con la empresa demo).
 * Hosts de prueba: *.localhost resuelve a loopback en Chromium (demo.localhost, admin.localhost…).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { launchOptions: { executablePath: chromium }, trace: "retain-on-failure" },
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
  },
});
