/**
 * Content-Security-Policy con nonce por solicitud (OWASP A05; guía de CSP de Next.js). Los scripts solo se ejecutan con el nonce
 * (`strict-dynamic` propaga la confianza a los que ellos cargan). Los estilos permiten `unsafe-inline` porque React emite atributos
 * `style` y la marca blanca inyecta variables CSS: el riesgo de XSS por estilos es bajo frente a los scripts.
 * `connect-src` incluye Wompi: la tokenización de tarjetas se hace desde el navegador contra su API (los datos de tarjeta nunca
 * pasan por nuestros servidores).
 */
export function buildCsp(opts: { nonce: string; dev?: boolean; https?: boolean }): string {
  const { nonce, dev = false, https = true } = opts;
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self' https://production.wompi.co https://sandbox.wompi.co${dev ? " ws: wss:" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}

/** Nonce aleatorio de 128 bits en base64 (Web Crypto: disponible en el runtime del proxy). */
export function newNonce(): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("base64");
}
