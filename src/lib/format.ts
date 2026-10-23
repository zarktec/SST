const TZ = "America/Bogota";

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: TZ,
  }).format(new Date(d));
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: TZ }).format(
    new Date(d),
  );
}

/** Montos en centavos (bigint/number) → "$ 200.000". Nunca flotantes para dinero. */
export function formatCOP(cents: bigint | number): string {
  const pesos = Number(BigInt(cents) / BigInt(100));
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(pesos);
}
