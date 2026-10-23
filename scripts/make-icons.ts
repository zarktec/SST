import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** Genera los íconos PNG de la PWA desde un SVG (ejecutar: pnpm exec tsx scripts/make-icons.ts). */
const shield = (bg: string, pad: number) => `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${bg}" rx="${pad ? 0 : 112}"/>
  <g transform="translate(256 256) scale(${pad ? 0.62 : 0.78}) translate(-256 -256)" fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round" stroke-linejoin="round">
    <path d="M256 64 96 128v112c0 104 66 176 160 208 94-32 160-104 160-208V128z"/>
    <path d="m180 256 56 56 100-112"/>
  </g>
</svg>`;

async function main() {
  const out = path.resolve("public/icons");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  const page = await browser.newPage();
  const jobs: [string, number, boolean][] = [
    ["icon-192.png", 192, false],
    ["icon-512.png", 512, false],
    ["maskable-512.png", 512, true],
    ["apple-touch-icon.png", 180, true],
  ];
  for (const [name, size, maskable] of jobs) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<body style="margin:0;background:transparent">${shield("#0f766e", maskable ? 1 : 0).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body>`,
    );
    await page.screenshot({ path: path.join(out, name), omitBackground: true });
  }
  await browser.close();
}
main();
