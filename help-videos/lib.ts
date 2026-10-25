import {
  chromium,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import { existsSync } from "node:fs";

/** Tamaño de los videos: 16:9, suficiente para leer la interfaz y ligero. */
export const VIEWPORT = { width: 1152, height: 648 };

const preinstalled = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
export async function launch(): Promise<Browser> {
  const path = process.env.CHROMIUM_PATH || (existsSync(preinstalled) ? preinstalled : undefined);
  return chromium.launch(path ? { executablePath: path } : {});
}

/**
 * Se inyecta en cada documento: dibuja un cursor (el video de Playwright no lo muestra), un efecto de clic y una franja de
 * subtítulos arriba. Todo vive en la «capa superior» (popover) para quedar por encima de los modales (`<dialog>`).
 */
const OVERLAY = `(() => {
  const init = () => {
    if (window.__rec) return;
    window.__rec = true;
    const base = 'position:fixed;inset:auto;margin:0;padding:0;border:0;background:transparent;overflow:visible;width:auto;height:auto;pointer-events:none;';
    const mk = (css) => { const e = document.createElement('div'); e.setAttribute('popover', 'manual'); e.style.cssText = base + css; return e; };
    const cap = mk('top:9px;left:50%;transform:translateX(-50%);max-width:68%;background:#fff;color:#001953;font:700 17px/1.3 system-ui,sans-serif;padding:9px 20px;border-radius:999px;text-align:center;box-shadow:0 4px 18px rgba(0,0,0,.35);border:2px solid #ff5800;display:none;');
    const cur = mk('left:0;top:0;width:30px;height:30px;');
    cur.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" style="position:absolute;left:0;top:0;filter:drop-shadow(0 1px 2px rgba(0,0,0,.55))"><path d="M4 2l15 9-6.5 1.6L9.8 19z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.body.append(cap, cur);
    const show = () => { for (const e of [cap, cur]) { try { e.hidePopover(); } catch (_) {} try { e.showPopover(); } catch (_) {} } };
    const set = (t) => { cap.textContent = t || ''; cap.style.display = t ? 'block' : 'none'; sessionStorage.setItem('__cap', t || ''); show(); };
    window.__setCaption = set;
    const place = (x, y) => { cur.style.left = x + 'px'; cur.style.top = y + 'px'; sessionStorage.setItem('__xy', x + ',' + y); };
    const xy = (sessionStorage.getItem('__xy') || '40,40').split(',').map(Number);
    place(xy[0], xy[1]);
    addEventListener('mousemove', (e) => place(e.clientX, e.clientY), true);
    addEventListener('mousedown', (e) => {
      const r = document.createElement('span');
      r.style.cssText = 'position:absolute;left:2px;top:2px;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:3px solid #ff5800;opacity:.9;';
      cur.append(r);
      r.animate([{ transform: 'scale(.3)', opacity: .95 }, { transform: 'scale(1.7)', opacity: 0 }], { duration: 520, easing: 'ease-out' }).onfinish = () => r.remove();
    }, true);
    let t;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(show, 0); }).observe(document, { subtree: true, attributes: true, attributeFilter: ['open'] });
    set(sessionStorage.getItem('__cap') || '');
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();`;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type CaptionCue = { at: number; text: string };

/** Piloto de una grabación: acciones con cursor visible, escritura natural y subtítulos con su línea de tiempo. */
export class Rec {
  cues: CaptionCue[] = [];
  private t0 = Date.now();
  constructor(
    readonly page: Page,
    readonly ctx: BrowserContext,
  ) {
    // Los avisos de confirmación del navegador no salen en el video: se aceptan solos.
    page.on("dialog", (d) => void d.accept().catch(() => undefined));
  }

  /** Fija el subtítulo actual (vacío = quitarlo) y lo deja leer un momento. */
  async say(text: string, readMs = 1400) {
    this.cues.push({ at: Date.now() - this.t0, text });
    await this.page
      .evaluate(
        (t) => (window as never as { __setCaption?: (t: string) => void }).__setCaption?.(t),
        text,
      )
      .catch(() => undefined);
    if (text) await wait(readMs);
  }
  async pause(ms = 700) {
    await wait(ms);
  }
  async goto(url: string) {
    await this.page.goto(url);
    await this.page.waitForLoadState("load");
    await wait(900);
    // Tras navegar, el subtítulo vigente se vuelve a pintar (lo guarda sessionStorage).
  }
  /** Mueve el cursor hasta el elemento con movimiento suave. */
  async hover(target: Locator) {
    await target.scrollIntoViewIfNeeded();
    const b = (await target.boundingBox())!;
    await this.page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 22 });
    await wait(300);
  }
  async click(target: Locator, after = 650) {
    await this.hover(target);
    await target.click({ delay: 90 });
    await wait(after);
  }
  /** Escribe como una persona (campos cortos). */
  async type(target: Locator, text: string, delay = 45) {
    await this.hover(target);
    await target.click();
    await target.fill("");
    await target.pressSequentially(text, { delay });
    await wait(350);
  }
  /** Para textos largos: pegado instantáneo con el cursor sobre el campo. */
  async fill(target: Locator, text: string) {
    await this.hover(target);
    await target.click();
    await target.fill(text);
    await wait(450);
  }
  async select(target: Locator, value: string | { label: string }) {
    await this.hover(target);
    await target.selectOption(value);
    await wait(500);
  }
  async check(target: Locator) {
    await this.hover(target);
    await target.check();
    await wait(450);
  }
  /** Dibuja una firma en un recuadro `canvas`. */
  async sign(canvas: Locator) {
    await canvas.scrollIntoViewIfNeeded();
    await wait(350);
    const b = (await canvas.boundingBox())!;
    const { mouse } = this.page;
    await mouse.move(b.x + 30, b.y + b.height * 0.6, { steps: 14 });
    await mouse.down();
    for (let i = 1; i <= 26; i++)
      await mouse.move(
        b.x + 30 + (i * (b.width - 80)) / 26,
        b.y + b.height * 0.5 + Math.sin(i / 2.2) * b.height * 0.28,
        { steps: 2 },
      );
    await mouse.up();
    await wait(600);
  }
  vtt(): string {
    const f = (ms: number) => {
      const h = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
      const m = String(Math.floor(ms / 60_000) % 60).padStart(2, "0");
      const s = String(Math.floor(ms / 1000) % 60).padStart(2, "0");
      return `${h}:${m}:${s}.${String(ms % 1000).padStart(3, "0")}`;
    };
    const end = Date.now() - this.t0;
    const out = ["WEBVTT", ""];
    this.cues.forEach((c, i) => {
      if (!c.text) return;
      const to = this.cues[i + 1]?.at ?? end;
      out.push(`${f(c.at)} --> ${f(Math.max(to, c.at + 800))}`, c.text, "");
    });
    return out.join("\n");
  }
}

export async function newRecording(
  browser: Browser,
  opts: { storageState?: string; videoDir: string },
) {
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    storageState: opts.storageState,
    recordVideo: { dir: opts.videoDir, size: VIEWPORT },
  });
  await ctx.addInitScript(OVERLAY);
  const page = await ctx.newPage();
  return new Rec(page, ctx);
}

/** Contexto normal (sin video) para preparar datos o iniciar sesión antes de grabar. */
export async function newSetup(browser: Browser, storageState?: string) {
  const ctx = await browser.newContext({ viewport: VIEWPORT, locale: "es-CO", storageState });
  return { ctx, page: await ctx.newPage() };
}
