import { describe, expect, it } from "vitest";

describe("todayYmd (hora de Colombia)", () => {
  it("después de las 7 p. m. en Bogotá la fecha sigue siendo la del día local, no la de UTC", async () => {
    const { todayYmd } = await import("./dates");
    expect(todayYmd(new Date("2026-06-02T03:00:00Z"))).toBe("2026-06-01"); // 10 p. m. del 1 de junio en Bogotá
    expect(todayYmd(new Date("2026-06-02T04:59:59Z"))).toBe("2026-06-01");
    expect(todayYmd(new Date("2026-06-02T05:00:00Z"))).toBe("2026-06-02"); // medianoche en Bogotá
    expect(todayYmd(new Date("2026-06-02T17:00:00Z"))).toBe("2026-06-02");
  });
});
