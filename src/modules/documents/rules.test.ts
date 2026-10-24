import { describe, expect, it } from "vitest";
import { bodyHash, documentSchema, nextReview, renderTemplate, reviewState } from "./rules";

describe("gestión documental", () => {
  it("vigencia: sin aprobar, sin revisión, vigente o por revisar", () => {
    expect(reviewState({ currentApproved: false, nextReviewOn: null }, "2026-06-01", 30)).toBe(
      "sin_aprobar",
    );
    expect(reviewState({ currentApproved: true, nextReviewOn: null }, "2026-06-01", 30)).toBe(
      "sin_revision",
    );
    expect(
      reviewState({ currentApproved: true, nextReviewOn: "2026-09-01" }, "2026-06-01", 30),
    ).toBe("vigente");
    expect(
      reviewState({ currentApproved: true, nextReviewOn: "2026-06-20" }, "2026-06-01", 30),
    ).toBe("por_revisar");
    expect(
      reviewState({ currentApproved: true, nextReviewOn: "2026-05-01" }, "2026-06-01", 30),
    ).toBe("por_revisar");
  });
  it("próxima revisión según la periodicidad", () => {
    expect(nextReview("2026-01-31", 12)).toBe("2027-01-31");
    expect(nextReview("2026-01-31", null)).toBeNull();
  });
  it("plantillas: reemplaza variables conocidas y deja visibles las demás", () => {
    expect(
      renderTemplate("Política de {{ empresa.razonSocial }} firmada por {{firmante}}", {
        "empresa.razonSocial": "ACME SAS",
      }),
    ).toBe("Política de ACME SAS firmada por {{firmante}}");
  });
  it("la huella del contenido es estable y cambia con el texto", () => {
    expect(bodyHash("hola")).toBe(bodyHash("hola"));
    expect(bodyHash("hola")).not.toBe(bodyHash("hola!"));
    expect(bodyHash("hola")).toMatch(/^[0-9a-f]{64}$/);
  });
  it("valida y normaliza el código del documento", () => {
    expect(
      documentSchema.parse({
        code: " pol-001 ",
        title: "Política de SST",
        kind: "policy",
        body: "Contenido de la política",
      }).code,
    ).toBe("POL-001");
    expect(
      documentSchema.safeParse({
        code: "a",
        title: "Política de SST",
        kind: "policy",
        body: "Contenido de la política",
      }).success,
    ).toBe(false);
  });
});
