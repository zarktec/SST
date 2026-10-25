import { ArrowLeft, ArrowRight, Play, Search } from "lucide-react";
import { NavIcon } from "@/components/layout/app-shell";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "@/components/ui/link";
import { cn } from "@/lib/utils";
import { searchArticles, type Article } from "@/modules/help/types";
import { videoOf } from "@/modules/help/videos";
import { ArticleVideo, BlockView } from "./article-view";
import { formatDuration } from "@/modules/help/videos";

/** Índice del centro de ayuda: buscador (formulario GET, funciona sin JavaScript) y guías agrupadas por tema. */
export function HelpIndex({
  articles,
  groups,
  q,
  intro,
  canOpen,
}: {
  articles: Article[];
  groups: string[];
  q?: string;
  intro: string;
  /** ¿Puede esta persona abrir el módulo de la guía? (para marcar las que su rol no ve). */
  canOpen: (a: Article) => boolean;
}) {
  const found = q ? searchArticles(articles, q) : null;
  const card = (a: Article) => (
    <li key={a.slug}>
      <Link
        href={`/ayuda/${a.slug}`}
        className="bg-card hover:border-primary flex min-h-16 items-start gap-3 rounded-xl border p-3 shadow-sm transition-colors"
      >
        <span className="bg-muted text-brand-text grid size-10 shrink-0 place-items-center rounded-lg">
          <NavIcon name={a.icon} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{a.title}</span>
          <span className="text-muted-foreground block text-xs leading-snug">{a.summary}</span>
          {videoOf(a.slug) && (
            <span className="text-brand-text mt-1 inline-flex items-center gap-1 text-xs font-medium">
              <Play className="size-3" aria-hidden /> Video ·{" "}
              {formatDuration(videoOf(a.slug)!.seconds)}
            </span>
          )}
          {!canOpen(a) && (
            <span className="text-muted-foreground mt-1 block text-xs italic">
              Tu rol no tiene acceso a esta pantalla
            </span>
          )}
        </span>
      </Link>
    </li>
  );
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Centro de ayuda</h1>
        <p className="text-muted-foreground text-sm">{intro}</p>
      </div>
      <form role="search" className="relative max-w-xl">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Buscar en la ayuda"
          placeholder="Buscar: firma, accidente, carga masiva…"
          className="border-input bg-background min-h-11 w-full rounded-lg border pr-24 pl-9 text-base"
        />
        <button
          type="submit"
          className="bg-primary text-primary-foreground absolute top-1 right-1 min-h-9 rounded-md px-3 text-sm font-medium"
        >
          Buscar
        </button>
      </form>
      {found ? (
        <section aria-live="polite" className="space-y-3">
          <h2 className="text-muted-foreground text-sm font-semibold">
            {found.length
              ? `${found.length} resultado${found.length === 1 ? "" : "s"} para “${q}”`
              : `Sin resultados para “${q}”`}
          </h2>
          {found.length > 0 ? (
            <ul className="grid gap-2 sm:grid-cols-2">{found.map(card)}</ul>
          ) : (
            <p className="text-sm">
              Prueba con otra palabra o{" "}
              <Link href="/ayuda" className="text-primary underline">
                mira todas las guías
              </Link>
              .
            </p>
          )}
        </section>
      ) : (
        groups.map((g) => {
          const items = articles.filter((a) => a.group === g);
          if (!items.length) return null;
          return (
            <section key={g} aria-labelledby={`h-${g}`} className="space-y-2">
              <h2 id={`h-${g}`} className="text-muted-foreground text-sm font-semibold">
                {g}
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2">{items.map(card)}</ul>
            </section>
          );
        })
      )}
    </div>
  );
}

/** Una guía: encabezado, cuerpo por bloques, botón para abrir la pantalla y navegación a la guía anterior/siguiente. */
export function HelpArticle({
  article,
  all,
  canOpen,
}: {
  article: Article;
  all: Article[];
  canOpen: boolean;
}) {
  const same = all.filter((a) => a.group === article.group);
  const i = same.findIndex((a) => a.slug === article.slug);
  const prev = i > 0 ? same[i - 1] : null;
  const next = i >= 0 && i < same.length - 1 ? same[i + 1] : null;
  const related = (article.related ?? [])
    .map((s) => all.find((a) => a.slug === s))
    .filter((a): a is Article => Boolean(a));
  return (
    <article className="space-y-5">
      <nav aria-label="Ruta" className="text-muted-foreground text-sm">
        <Link href="/ayuda" className="text-primary underline">
          Centro de ayuda
        </Link>{" "}
        / {article.group}
      </nav>
      <header className="space-y-2">
        <div className="flex items-start gap-3">
          <span className="bg-muted text-brand-text grid size-11 shrink-0 place-items-center rounded-xl">
            <NavIcon name={article.icon} />
          </span>
          <div>
            <h1 className="text-2xl font-bold">{article.title}</h1>
            <p className="text-muted-foreground">{article.summary}</p>
          </div>
        </div>
        {article.who && (
          <p className="text-sm">
            <span className="font-semibold">Quién lo usa: </span>
            {article.who}
          </p>
        )}
        {article.route && (
          <div>
            {canOpen ? (
              <Link href={article.route} className={cn(buttonVariants({ size: "sm" }))}>
                Abrir esta pantalla
              </Link>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                Tu rol no tiene acceso a esta pantalla. Pide a un administrador que revise tus
                permisos.
              </p>
            )}
          </div>
        )}
      </header>
      <ArticleVideo slug={article.slug} />
      <Card className="space-y-5">
        {article.blocks.map((b, k) => (
          <BlockView key={k} block={b} />
        ))}
      </Card>
      {related.length > 0 && (
        <section aria-labelledby="rel" className="space-y-2">
          <h2 id="rel" className="text-muted-foreground text-sm font-semibold">
            También te puede interesar
          </h2>
          <ul className="flex flex-wrap gap-2">
            {related.map((r) => (
              <li key={r.slug}>
                <Link
                  href={`/ayuda/${r.slug}`}
                  className="bg-card hover:border-primary inline-flex min-h-11 items-center rounded-lg border px-3 text-sm"
                >
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(prev || next) && (
        <nav aria-label="Guías del mismo tema" className="flex flex-wrap justify-between gap-2">
          {prev ? (
            <Link
              href={`/ayuda/${prev.slug}`}
              className="bg-card hover:border-primary inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm"
            >
              <ArrowLeft className="size-4" aria-hidden /> {prev.title}
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link
              href={`/ayuda/${next.slug}`}
              className="bg-card hover:border-primary inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm"
            >
              {next.title} <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </nav>
      )}
    </article>
  );
}
