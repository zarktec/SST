import { afterAll, describe, expect, it } from "vitest";
import { closeDb } from "@/core/db";
import { hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { tooManyAttempts } from "./rate-limit";

pointToTestDb();
const key = () => `t:${Math.random().toString(36).slice(2)}`;

describe.skipIf(!hasTestDb)("límite de intentos compartido", () => {
  afterAll(closeDb);
  it("permite hasta el máximo y bloquea el siguiente", async () => {
    const k = key();
    for (let i = 0; i < 3; i++) expect(await tooManyAttempts(k, 3, 60)).toBe(false);
    expect(await tooManyAttempts(k, 3, 60)).toBe(true);
    expect(await tooManyAttempts(k, 3, 60)).toBe(true);
  });
  it("las llaves son independientes", async () => {
    const [a, b] = [key(), key()];
    for (let i = 0; i < 3; i++) await tooManyAttempts(a, 2, 60);
    expect(await tooManyAttempts(a, 2, 60)).toBe(true);
    expect(await tooManyAttempts(b, 2, 60)).toBe(false);
  });
  it("es atómico bajo concurrencia: exactamente `max` intentos pasan", async () => {
    const k = key();
    const results = await Promise.all(Array.from({ length: 12 }, () => tooManyAttempts(k, 5, 60)));
    expect(results.filter((blocked) => !blocked)).toHaveLength(5);
  });
  it("la ventana vencida reinicia la cuenta", async () => {
    const k = key();
    for (let i = 0; i < 3; i++) await tooManyAttempts(k, 2, 1);
    expect(await tooManyAttempts(k, 2, 1)).toBe(true);
    await new Promise((r) => setTimeout(r, 1200));
    expect(await tooManyAttempts(k, 2, 1)).toBe(false);
  });
});
