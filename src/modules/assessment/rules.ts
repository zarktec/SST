export type ItemStatus = "pending" | "cumple" | "no_cumple" | "no_aplica";
export type ScoredItem = { status: ItemStatus; weight: number };
export type RatingRange = {
  level: string;
  label: string;
  minPct: number | null;
  maxPct: number | null;
  minInclusive: boolean;
  maxInclusive: boolean;
  actions: string[];
};

/**
 * Puntaje de la autoevaluación (Resolución 0312 de 2019): suma de los valores de los ítems que cumplen sobre el total
 * de los ítems del grupo aplicable. Un ítem "no aplica" (con justificación) se califica con su valor máximo.
 * TODO-NORMA: confirmar con un experto SST el tratamiento de "no aplica" (parámetro `noApplyCountsAsFull`).
 */
export function scoreAssessment(
  items: ScoredItem[],
  opts: { noApplyCountsAsFull: boolean } = { noApplyCountsAsFull: true },
) {
  let total = 0;
  let earned = 0;
  for (const i of items) {
    total += i.weight;
    if (i.status === "cumple" || (i.status === "no_aplica" && opts.noApplyCountsAsFull))
      earned += i.weight;
  }
  const pct = total === 0 ? 0 : Math.round((earned / total) * 10000) / 100;
  return { total, earned, pct };
}

/** Rango de calificación (crítico / moderadamente aceptable / aceptable) según los límites e inclusiones del catálogo. */
export function ratingFor(pct: number, ranges: RatingRange[]): RatingRange | null {
  return (
    ranges.find((r) => {
      const aboveMin = r.minPct === null || (r.minInclusive ? pct >= r.minPct : pct > r.minPct);
      const belowMax = r.maxPct === null || (r.maxInclusive ? pct <= r.maxPct : pct < r.maxPct);
      return aboveMin && belowMax;
    }) ?? null
  );
}

/** Errores que impiden cerrar: ítems sin responder y "no aplica" sin justificación. */
export function closeBlockers(
  items: { itemCode: string; status: ItemStatus; justification: string | null }[],
): string[] {
  const out: string[] = [];
  const pending = items.filter((i) => i.status === "pending");
  if (pending.length) out.push(`Faltan ${pending.length} ítems por calificar`);
  for (const i of items)
    if (i.status === "no_aplica" && !i.justification?.trim())
      out.push(`El ítem ${i.itemCode} no aplica y requiere justificación`);
  return out;
}

export type Comparison = { year: number; pct: number; level: string | null }[];
/** Tendencia entre años: variación puntual frente a la evaluación cerrada anterior. */
export function trend(history: Comparison): { year: number; pct: number; delta: number | null }[] {
  const sorted = [...history].sort((a, b) => a.year - b.year);
  return sorted.map((h, i) => ({
    year: h.year,
    pct: h.pct,
    delta: i === 0 ? null : Math.round((h.pct - sorted[i - 1].pct) * 100) / 100,
  }));
}

/**
 * ¿Está abierta la ventana de autoevaluación? Se aplica en `windowMonth` (diciembre por defecto) y el registro ante el
 * Ministerio tiene fecha límite parametrizada (la fija la circular anual). TODO-NORMA: validar mes y plazo.
 */
export function assessmentReminder(
  today: string,
  opts: { windowMonth: number; ministryDeadline: string | null },
  closedThisYear: boolean,
  registeredThisYear: boolean,
): "aplicar" | "registrar" | null {
  const month = Number(today.slice(5, 7));
  if (!closedThisYear && month >= opts.windowMonth) return "aplicar";
  if (
    closedThisYear &&
    !registeredThisYear &&
    opts.ministryDeadline &&
    today <= opts.ministryDeadline
  )
    return "registrar";
  return null;
}
