/** fetch con tiempo límite para las pruebas de conexión. */
export async function fetchWithTimeout(
  f: typeof fetch,
  url: string,
  init: RequestInit = {},
  ms = 8000,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await f(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export function networkError(e: unknown): { ok: false; message: string } {
  const msg = e instanceof Error ? e.message : String(e);
  return { ok: false, message: `No se pudo conectar: ${msg}` };
}
