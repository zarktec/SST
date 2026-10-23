/** Deduce el método de acceso a partir de la ruta de Better Auth que creó la sesión. */
export function loginMethodFromPath(path: string): string | null {
  if (path.startsWith("/sign-in/email") || path.startsWith("/sign-up/email")) return "password";
  if (path.startsWith("/two-factor/verify")) return "password";
  if (path.startsWith("/magic-link/verify")) return "magic_link";
  const m = path.match(/^\/callback\/(google|microsoft)/);
  return m ? m[1] : null;
}
