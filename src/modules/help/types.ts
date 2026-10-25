import type { IconName } from "@/components/layout/nav-config";

/** Bloques de contenido de un artículo de ayuda. El texto admite `**negrita**`. */
export type Block =
  | { t: "p"; text: string }
  | { t: "steps"; title?: string; items: string[] }
  | { t: "list"; title?: string; items: string[] }
  | { t: "defs"; items: { term: string; def: string }[] }
  | { t: "tip" | "warn" | "note"; text: string };

export type Article = {
  /** Va en la URL: `/ayuda/{slug}`. Si coincide con la primera ruta del módulo, la ayuda contextual lo encuentra sola. */
  slug: string;
  title: string;
  group: string;
  icon: IconName;
  /** Una o dos frases: qué es y para qué sirve. */
  summary: string;
  /** Módulo de permisos que da acceso a la pantalla (si aplica). */
  module?: string;
  /** Ruta de la pantalla dentro de la app. */
  route?: string;
  /** Quién usa normalmente esta pantalla. */
  who?: string;
  keywords?: string[];
  related?: string[];
  blocks: Block[];
};

export const textOf = (a: Article): string =>
  [
    a.title,
    a.summary,
    a.who ?? "",
    ...(a.keywords ?? []),
    ...a.blocks.flatMap((b) =>
      b.t === "steps" || b.t === "list"
        ? [b.title ?? "", ...b.items]
        : b.t === "defs"
          ? b.items.flatMap((d) => [d.term, d.def])
          : [b.text],
    ),
  ].join(" ");

/** Minúsculas sin tildes, para buscar sin importar acentos. */
export const normalize = (s: string): string =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Artículos que contienen todas las palabras buscadas (título y resumen pesan más al ordenar). */
export function searchArticles(articles: Article[], q: string): Article[] {
  const words = normalize(q).split(/\s+/).filter(Boolean);
  if (!words.length) return articles;
  return articles
    .map((a) => {
      const hay = normalize(textOf(a));
      if (!words.every((w) => hay.includes(w))) return null;
      const head = normalize(`${a.title} ${a.summary} ${(a.keywords ?? []).join(" ")}`);
      return { a, score: words.filter((w) => head.includes(w)).length };
    })
    .filter((x): x is { a: Article; score: number } => x !== null)
    .sort((x, y) => y.score - x.score)
    .map((x) => x.a);
}

/** `{ personas: "personas", ... }`: primera ruta de cada módulo → artículo, para el botón de ayuda contextual. */
export function routeMap(articles: Article[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of articles) {
    const seg = a.route?.split("/")[1];
    if (seg && !out[seg]) out[seg] = a.slug;
  }
  return out;
}
