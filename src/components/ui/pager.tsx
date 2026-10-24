import Link from "@/components/ui/link";
import { pageCount } from "@/lib/pagination";

/**
 * Paginación por enlaces (funciona sin JavaScript y con teclado). Conserva los demás parámetros de la consulta.
 * `base` es la ruta visible (sin el prefijo interno del proxy).
 */
export function Pager({
  base,
  params = {},
  page,
  total,
  size,
}: {
  base: string;
  params?: Record<string, string | undefined>;
  page: number;
  total: number;
  size?: number;
}) {
  const pages = pageCount(total, size);
  if (pages <= 1) return null;
  const href = (p: number) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v) as [string, string][],
    );
    if (p > 1) q.set("p", String(p));
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };
  const cls =
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border px-3 text-sm";
  return (
    <nav aria-label="Paginación" className="mt-3 flex flex-wrap items-center gap-2">
      {page > 1 ? (
        <Link href={href(page - 1)} className={cls} rel="prev">
          ← Anterior
        </Link>
      ) : (
        <span className={`${cls} opacity-50`} aria-disabled="true">
          ← Anterior
        </span>
      )}
      <span className="text-sm" aria-live="polite">
        Página {page} de {pages} · {total} registros
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className={cls} rel="next">
          Siguiente →
        </Link>
      ) : (
        <span className={`${cls} opacity-50`} aria-disabled="true">
          Siguiente →
        </span>
      )}
    </nav>
  );
}
