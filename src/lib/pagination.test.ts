import { describe, expect, it } from "vitest";
import { pageCount, parsePage } from "./pagination";

describe("paginación", () => {
  it("lee la página de la consulta con valores seguros por defecto", () => {
    expect(parsePage({})).toEqual({ page: 1, size: 25, limit: 25, offset: 0 });
    expect(parsePage({ p: "3" })).toMatchObject({ page: 3, offset: 50 });
    for (const bad of ["0", "-2", "abc", "1.5", "999999", ""])
      expect(parsePage({ p: bad }).page).toBe(1);
    expect(parsePage({ p: ["2", "3"] }).page).toBe(1);
    expect(parsePage({ p: "2" }, 10)).toMatchObject({ limit: 10, offset: 10 });
  });
  it("cuenta las páginas (mínimo una)", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(25)).toBe(1);
    expect(pageCount(26)).toBe(2);
    expect(pageCount(100, 10)).toBe(10);
  });
});
