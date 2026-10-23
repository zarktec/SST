import { describe, expect, it } from "vitest";
import { buildCertificate } from "./certificate";

describe("certificado PDF", () => {
  it("genera un PDF válido con tildes y color de marca inválido tolerado", async () => {
    const bytes = await buildCertificate({
      companyName: "Construcciones Ñandú S.A.S.",
      brandHex: "no-es-color",
      workerName: "José Peña",
      documentLast4: "6789",
      courseName: "Inducción y reinducción en SST",
      date: "2026-10-01",
      hours: "2",
      score: 90,
      trainer: "Ana Gómez",
      evidenceHash: "a".repeat(64),
    });
    expect(Buffer.from(bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
