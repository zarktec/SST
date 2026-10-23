/** Estado común de los formularios con useActionState: mensaje, errores por campo y valores para repoblar (React 19 reinicia el form). */
export type FormState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string | boolean | string[]>;
  /** Detalle adicional (p. ej. filas con error de una carga masiva). */
  details?: string[];
} | null;

export function formValues(f: FormData): Record<string, string | boolean | string[]> {
  const out: Record<string, string | boolean | string[]> = {};
  for (const k of new Set(f.keys())) {
    const all = f.getAll(k).filter((v): v is string => typeof v === "string");
    out[k] = all.length > 1 ? all : (all[0] ?? "");
  }
  return out;
}

/** Convierte los issues de zod en errores por campo (primer mensaje de cada ruta). */
export function zodFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0] ?? "_")] ??= i.message;
  return out;
}
