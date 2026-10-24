import { describe, expect, it } from "vitest";
import { bySeverity, diffAlerts, digestHtml, icsCalendar, type AlertItem } from "./rules";

const a = (key: string, severity: AlertItem["severity"] = "warning"): AlertItem => ({
  key,
  module: "actions",
  severity,
  title: `T ${key}`,
});

describe("notificaciones", () => {
  it("diferencia nuevas, reabiertas, vigentes y resueltas", () => {
    const d = diffAlerts(
      [
        { key: "a", resolvedAt: null },
        { key: "b", resolvedAt: null },
        { key: "c", resolvedAt: new Date() },
      ],
      [a("a"), a("c"), a("d")],
    );
    expect(d.created.map((x) => x.key)).toEqual(["d"]);
    expect(d.reopened.map((x) => x.key)).toEqual(["c"]);
    expect(d.kept.map((x) => x.key)).toEqual(["a"]);
    expect(d.resolved).toEqual(["b"]);
  });
  it("ordena por gravedad y escapa el HTML del correo", () => {
    expect(bySeverity([a("1", "info"), a("2", "critical"), a("3")]).map((x) => x.key)).toEqual([
      "2",
      "3",
      "1",
    ]);
    const html = digestHtml(
      "Hola",
      [{ ...a("x"), title: "<b>x</b>", href: "/acciones" }],
      "https://demo.sst.zark.pro",
    );
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).toContain('href="https://demo.sst.zark.pro/acciones"');
  });
  it("iCalendar: eventos de día completo, escape y plegado de líneas", () => {
    const long = "Acción: " + "muy larga ".repeat(20) + "; con coma, y salto\nde línea";
    const ics = icsCalendar(
      [{ uid: "e1", date: "2026-12-31", title: long, module: "actions", href: "/acciones" }],
      "Obligaciones",
      "https://x.test",
      new Date("2026-06-01T10:00:00Z"),
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20270101\r\n");
    expect(ics).toContain("DTSTAMP:20260601T100000Z");
    expect(ics).toContain("\;");
    expect(ics).toContain("\\,");
    expect(ics).toContain("\\n");
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
