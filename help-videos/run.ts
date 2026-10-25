/**
 * Graba los videos de la documentación contra el sistema real (empresa demo) y los deja en `public/help/videos`.
 *   pnpm build && pnpm db:migrate && pnpm db:seed && pnpm help:videos [slug …]
 * Cada video: sesión iniciada sin grabar (salvo el de ingreso), datos reiniciados, cursor y subtítulos superpuestos,
 * y salida en MP4 (H.264) + WebM (VP9) + subtítulos .vtt + póster .jpg.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loginAdminWith2fa, resetState, seedStandardsCatalog } from "../e2e/helpers";
import { Pool } from "pg";
import { launch, newRecording, newSetup } from "./lib";
import { SCENARIOS } from "./scenarios";
import { TENANT } from "./types";

const OUT = join(process.cwd(), "public/help/videos");
const META = join(process.cwd(), "src/modules/help/video-meta.json");

async function serverUp() {
  try {
    return (await fetch("http://localhost:3000/offline")).ok;
  } catch {
    return false;
  }
}

async function main() {
  const only = process.argv.slice(2);
  const list = SCENARIOS.filter((s) => !only.length || only.includes(s.slug));
  if (!list.length) throw new Error(`Sin escenarios para: ${only.join(", ")}`);
  mkdirSync(OUT, { recursive: true });

  let server: ChildProcess | undefined;
  if (!(await serverUp())) {
    server = spawn("pnpm", ["start"], {
      stdio: "ignore",
      env: { ...process.env, CRON_SECRET: "e2e-cron-secret" },
    });
    for (let i = 0; i < 60 && !(await serverUp()); i++)
      await new Promise((r) => setTimeout(r, 1000));
  }
  const browser = await launch();
  const meta: Record<string, { title: string; seconds: number }> = JSON.parse(
    (() => {
      try {
        return readFileSync(META, "utf8");
      } catch {
        return "{}";
      }
    })(),
  );
  try {
    for (const s of list) {
      console.log(`▶ ${s.slug}`);
      await resetState();
      // Datos fiscales de la empresa demo en blanco: el video los llena desde cero.
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      await pool.query(
        "DELETE FROM billing_profile WHERE tenant_id = (SELECT id FROM tenant WHERE slug = 'demo')",
      );
      if (s.onboarded)
        await pool.query(
          "UPDATE tenant SET workers_count = 12, risk_class = 1, standards_group = 7 WHERE slug = 'demo'",
        );
      await pool.end();
      if (s.catalog) await seedStandardsCatalog();
      const tmp = mkdtempSync(join(tmpdir(), "helpvid-"));
      let storageState: string | undefined;
      if (s.as !== "anon") {
        const { ctx, page } = await newSetup(browser);
        if (s.as === "admin") await loginAdminWith2fa(page);
        else {
          await page.goto(`${TENANT}/login`);
          await page.waitForLoadState("networkidle");
          await page.getByLabel("Correo electrónico").fill("demo@demo.test");
          await page.getByLabel("Contraseña").fill("DemoClave-2026!");
          await page.getByRole("button", { name: "Ingresar" }).click();
          await page.waitForURL(TENANT);
        }
        if (s.setup) await s.setup(page);
        storageState = join(tmp, "state.json");
        await ctx.storageState({ path: storageState });
        await ctx.close();
      } else if (s.setup) {
        const { ctx, page } = await newSetup(browser);
        await s.setup(page);
        await ctx.close();
      }
      const rec = await newRecording(browser, { storageState, videoDir: tmp });
      let ok = true;
      try {
        await s.run(rec);
        await rec.say("", 0);
        await rec.pause(900);
      } catch (e) {
        ok = false;
        console.error(`✗ ${s.slug}:`, e instanceof Error ? e.message.split("\n")[0] : e);
        await rec.page
          .screenshot({ path: join(tmpdir(), `helpvid-fail-${s.slug}.png`) })
          .catch(() => undefined);
      }
      const video = rec.page.video();
      await rec.ctx.close();
      if (!ok || !video) continue;
      const raw = await video.path();
      const mp4 = join(OUT, `${s.slug}.mp4`);
      execFileSync("ffmpeg", [
        "-y",
        "-loglevel",
        "error",
        "-i",
        raw,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        "28",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        mp4,
      ]);
      execFileSync("ffmpeg", [
        "-y",
        "-loglevel",
        "error",
        "-i",
        raw,
        "-an",
        "-c:v",
        "libvpx-vp9",
        "-b:v",
        "0",
        "-crf",
        "40",
        "-row-mt",
        "1",
        join(OUT, `${s.slug}.webm`),
      ]);
      execFileSync("ffmpeg", [
        "-y",
        "-loglevel",
        "error",
        "-ss",
        "2.5",
        "-i",
        mp4,
        "-frames:v",
        "1",
        "-q:v",
        "5",
        join(OUT, `${s.slug}.jpg`),
      ]);
      writeFileSync(join(OUT, `${s.slug}.vtt`), rec.vtt());
      const seconds = Math.round(
        Number(
          execFileSync("ffprobe", [
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
            mp4,
          ]).toString(),
        ),
      );
      meta[s.slug] = { title: s.title, seconds };
      rmSync(tmp, { recursive: true, force: true });
      console.log(`✓ ${s.slug} (${seconds}s)`);
    }
  } finally {
    await browser.close();
    server?.kill();
    writeFileSync(
      META,
      JSON.stringify(Object.fromEntries(Object.entries(meta).sort()), null, 2) + "\n",
    );
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
