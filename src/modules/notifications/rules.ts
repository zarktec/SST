export type Severity = "info" | "warning" | "critical";
export type AlertItem = {
  /** Estable: módulo + entidad (la misma alerta no se duplica). */
  key: string;
  /** Módulo de permisos que debe poder ver la alerta. */
  module: string;
  severity: Severity;
  title: string;
  detail?: string | null;
  href?: string | null;
  dueOn?: string | null;
};
export type CalendarEvent = {
  uid: string;
  date: string;
  title: string;
  module: string;
  href?: string;
};

type Existing = { key: string; resolvedAt: Date | null };

/** Compara las alertas vigentes con las guardadas: cuáles son nuevas, cuáles siguen y cuáles ya se resolvieron. */
export function diffAlerts(existing: Existing[], collected: AlertItem[]) {
  const have = new Map(existing.map((e) => [e.key, e]));
  const now = new Set(collected.map((c) => c.key));
  return {
    created: collected.filter((c) => !have.has(c.key)),
    reopened: collected.filter((c) => have.get(c.key)?.resolvedAt),
    kept: collected.filter((c) => have.has(c.key) && !have.get(c.key)!.resolvedAt),
    resolved: existing.filter((e) => !e.resolvedAt && !now.has(e.key)).map((e) => e.key),
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
export const bySeverity = <T extends { severity: Severity }>(l: T[]) =>
  [...l].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

/** Cuerpo HTML del correo de alertas (nuevas o resumen semanal). */
export function digestHtml(intro: string, items: AlertItem[], baseUrl: string): string {
  const rows = bySeverity(items)
    .map((i) => {
      const color =
        i.severity === "critical" ? "#b91c1c" : i.severity === "warning" ? "#b45309" : "#1d4ed8";
      const link = i.href ? ` — <a href="${esc(baseUrl + i.href)}">ver</a>` : "";
      return `<li><strong style="color:${color}">${esc(i.title)}</strong>${i.detail ? `: ${esc(i.detail)}` : ""}${link}</li>`;
    })
    .join("");
  return `<p>${esc(intro)}</p><ul>${rows}</ul>`;
}

/** Texto de iCalendar: escapa y pliega líneas a 75 octetos (RFC 5545 §3.1 y §3.3.11). */
const icsEscape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}
const ymdCompact = (d: string) => d.replace(/-/g, "");
const nextDay = (d: string) => new Date(Date.parse(d) + 86_400_000).toISOString().slice(0, 10);

/** Calendario iCalendar de eventos de todo el día (importable en Google Calendar, Outlook y Apple Calendar). */
export function icsCalendar(
  events: CalendarEvent[],
  calName: string,
  baseUrl: string,
  now: Date,
): string {
  const stamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SST//Calendario de obligaciones//ES",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsEscape(calName)}`,
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${icsEscape(e.uid)}@sst`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymdCompact(e.date)}`,
      `DTEND;VALUE=DATE:${ymdCompact(nextDay(e.date))}`,
      `SUMMARY:${icsEscape(e.title)}`,
      ...(e.href ? [`URL:${baseUrl}${e.href}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
