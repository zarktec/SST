/** Contraste WCAG 2.1 (AA: 4.5:1 texto normal, 3:1 texto grande/componentes de UI). */

export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;

export function isHex(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

export function hexToRgb(hex: string): [number, number, number] {
  if (!isHex(hex)) throw new Error(`Color inválido: ${hex}`);
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

export function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b]
    .map((v) =>
      Math.round(Math.min(255, Math.max(0, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mezcla `hex` con blanco (t>0) o negro (t<0). */
function mix(hex: string, t: number): string {
  const target = t >= 0 ? 255 : 0;
  const k = Math.abs(t);
  return rgbToHex(hexToRgb(hex).map((v) => v + (target - v) * k) as [number, number, number]);
}

/**
 * Ajusta `hex` (aclarándolo u oscureciéndolo lo mínimo) hasta alcanzar `min` contra `against`.
 * Mantiene el tono. Devuelve el mismo color si ya cumple.
 */
export function suggestAccessible(hex: string, against: string, min = AA_NORMAL): string {
  if (contrastRatio(hex, against) >= min) return hex.toLowerCase();
  const darker = luminance(against) > 0.5; // fondo claro → oscurecer el color
  for (let step = 1; step <= 100; step++) {
    const candidate = mix(hex, darker ? -step / 100 : step / 100);
    if (contrastRatio(candidate, against) >= min) return candidate;
  }
  return darker ? "#000000" : "#ffffff";
}

/** Texto (blanco o casi negro) con mejor contraste sobre `bg`. */
export function readableOn(bg: string): string {
  return contrastRatio("#ffffff", bg) >= contrastRatio("#111111", bg) ? "#ffffff" : "#111111";
}

export type BrandInput = { primary: string; secondary: string; accent: string };
export type BrandCheck = {
  key: string;
  label: string;
  ratio: number;
  passesAA: boolean;
  /** Color sugerido cuando no cumple. */
  suggestion?: string;
};

export const LIGHT_BG = "#ffffff";
export const DARK_BG = "#0a0a0a";

/** Identidad ZarK: valores por defecto de toda empresa que no define su propia marca. */
export const ZARK_BRAND: BrandInput = {
  primary: "#001953",
  secondary: "#001953",
  accent: "#ff5800",
};

/** Paleta que tenía el tema oscuro antes de la identidad ZarK: el tema oscuro de una empresa sin marca propia la conserva. */
export const DARK_DEFAULT_BRAND: BrandInput = {
  primary: "#0f766e",
  secondary: "#1e293b",
  accent: "#f59e0b",
};

/** Verificación AA de la paleta de la empresa (se guarda en tenant_branding.contrast_report). */
export function checkBrand(brand: BrandInput): BrandCheck[] {
  const checks: BrandCheck[] = [];
  for (const [name, hex] of Object.entries(brand) as [keyof BrandInput, string][]) {
    const onBtn = contrastRatio(hex, readableOn(hex));
    checks.push({
      key: `${name}.button`,
      label: `Texto sobre botón ${name}`,
      ratio: round(onBtn),
      passesAA: onBtn >= AA_NORMAL,
      suggestion: onBtn >= AA_NORMAL ? undefined : suggestAccessible(hex, readableOn(hex)),
    });
  }
  const onLight = contrastRatio(brand.primary, LIGHT_BG);
  checks.push({
    key: "primary.onLight",
    label: "Color primario como texto/enlace sobre fondo claro",
    ratio: round(onLight),
    passesAA: onLight >= AA_NORMAL,
    suggestion: onLight >= AA_NORMAL ? undefined : suggestAccessible(brand.primary, LIGHT_BG),
  });
  return checks;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Variables CSS en tiempo de ejecución para una empresa (modo claro/oscuro). */
export function brandCssVars(brand: BrandInput): {
  light: Record<string, string>;
  dark: Record<string, string>;
} {
  const isZark = (Object.keys(ZARK_BRAND) as (keyof BrandInput)[]).every(
    (k) => brand[k].toLowerCase() === ZARK_BRAND[k],
  );
  const vars = (
    bg: string,
    b: BrandInput,
    nav: { bg: string; fg: string },
  ): Record<string, string> => ({
    "--primary": b.primary,
    "--primary-foreground": readableOn(b.primary),
    "--secondary": b.secondary,
    "--secondary-foreground": readableOn(b.secondary),
    "--accent": b.accent,
    "--accent-foreground": readableOn(b.accent),
    // Para texto/enlaces con color de marca: garantiza AA contra el fondo del tema.
    "--brand-text": suggestAccessible(b.primary, bg),
    // Ítem activo del menú lateral.
    "--nav-active-bg": nav.bg,
    "--nav-active-fg": nav.fg,
  });
  // Tema claro: ítem activo con el acento (aclarado/oscurecido lo mínimo para que el texto blanco cumpla AA) y foco con el acento.
  const light = {
    ...vars(LIGHT_BG, brand, { bg: suggestAccessible(brand.accent, "#ffffff"), fg: "#ffffff" }),
    "--ring": brand.accent,
  };
  // Tema oscuro: una empresa sin marca propia (la de ZarK) conserva la paleta oscura de siempre.
  const darkBrand = isZark ? DARK_DEFAULT_BRAND : brand;
  const dark = {
    ...vars(DARK_BG, darkBrand, { bg: darkBrand.primary, fg: readableOn(darkBrand.primary) }),
    "--ring": darkBrand.primary,
  };
  return { light, dark };
}

/** `<style>` con las variables de marca de una empresa (se inyecta en el layout del tenant). */
export function brandStyleSheet(brand: BrandInput): string {
  const { light, dark } = brandCssVars(brand);
  const toCss = (o: Record<string, string>) =>
    Object.entries(o)
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
  return `:root{${toCss(light)}}@media (prefers-color-scheme:dark){:root:not([data-theme=light]){${toCss(dark)}}}:root[data-theme=dark]{${toCss(dark)}}`;
}
