import { describe, expect, it } from "vitest";
import {
  authorizeBlockers,
  certificateValidOn,
  parseChecklist,
  permitState,
  type AuthorizeCheck,
} from "./rules";

const base: AuthorizeCheck = {
  requiresCertificate: true,
  requiresRescuePlan: true,
  maxHours: 8,
  checklist: [
    { id: "c1", text: "Anclajes verificados", required: true, answer: "ok" },
    { id: "c2", text: "Clima", required: false },
  ],
  rescuePlan: "Rescate con camilla y brigada",
  validFrom: new Date("2026-06-01T13:00:00Z"),
  validUntil: new Date("2026-06-01T19:00:00Z"),
  workers: [{ workerId: "w1", name: "Ana" }],
  coordinatorWorkerId: "w2",
  certificates: [
    { workerId: "w1", level: "authorized", issuedOn: "2026-01-01", expiresOn: "2027-01-01" },
    { workerId: "w2", level: "coordinator", issuedOn: "2026-01-01", expiresOn: "2027-01-01" },
  ],
  workDate: "2026-06-01",
};

describe("autorización de permisos de alto riesgo", () => {
  it("sin bloqueos cuando todo está en regla", () => expect(authorizeBlockers(base)).toEqual([]));
  it("exige certificado vigente de cada trabajador el día del trabajo", () => {
    const b = authorizeBlockers({
      ...base,
      certificates: [
        { workerId: "w1", level: "authorized", issuedOn: "2025-01-01", expiresOn: "2026-05-31" },
        base.certificates[1],
      ],
    });
    expect(b).toEqual(["Ana no tiene certificado de alturas vigente"]);
  });
  it("exige coordinador con certificado de coordinador (no basta el de autorizado)", () => {
    expect(authorizeBlockers({ ...base, coordinatorWorkerId: null })).toEqual([
      "Falta el coordinador de trabajo en alturas",
    ]);
    expect(authorizeBlockers({ ...base, coordinatorWorkerId: "w1" })).toEqual([
      "El coordinador no tiene certificado de coordinador vigente",
    ]);
  });
  it("lista de verificación obligatoria, plan de rescate y duración máxima", () => {
    expect(
      authorizeBlockers({
        ...base,
        checklist: [{ id: "c1", text: "Anclajes verificados", required: true }],
        rescuePlan: " ",
      }),
    ).toEqual(["Lista de verificación: Anclajes verificados", "Falta el plan de rescate"]);
    expect(authorizeBlockers({ ...base, validUntil: new Date("2026-06-01T22:00:01Z") })).toEqual([
      "El permiso no puede durar más de 8 horas",
    ]);
    expect(
      authorizeBlockers({
        ...base,
        checklist: [{ id: "c1", text: "Anclajes verificados", required: true, answer: "na" }],
      }),
    ).toEqual(['Lista de verificación: Anclajes verificados no puede ser "no aplica"']);
  });
  it("un tipo sin certificado no exige certificados ni coordinador", () => {
    expect(
      authorizeBlockers({
        ...base,
        requiresCertificate: false,
        requiresRescuePlan: false,
        certificates: [],
        coordinatorWorkerId: null,
      }),
    ).toEqual([]);
  });
});

describe("estado y utilidades", () => {
  const p = {
    validFrom: new Date("2026-06-01T13:00:00Z"),
    validUntil: new Date("2026-06-01T19:00:00Z"),
  };
  it("estado del permiso", () => {
    expect(permitState({ ...p, status: "requested" }, new Date("2026-06-01T14:00:00Z"))).toBe(
      "solicitado",
    );
    expect(permitState({ ...p, status: "authorized" }, new Date("2026-06-01T12:00:00Z"))).toBe(
      "programado",
    );
    expect(permitState({ ...p, status: "authorized" }, new Date("2026-06-01T14:00:00Z"))).toBe(
      "vigente",
    );
    expect(permitState({ ...p, status: "authorized" }, new Date("2026-06-01T20:00:00Z"))).toBe(
      "vencido",
    );
    expect(permitState({ ...p, status: "closed" }, new Date("2026-06-01T20:00:00Z"))).toBe(
      "cerrado",
    );
  });
  it("vigencia del certificado y lista de verificación en texto", () => {
    expect(
      certificateValidOn({ issuedOn: "2026-01-01", expiresOn: "2026-12-31" }, "2026-12-31"),
    ).toBe(true);
    expect(
      certificateValidOn({ issuedOn: "2026-01-01", expiresOn: "2026-12-31" }, "2027-01-01"),
    ).toBe(false);
    expect(parseChecklist("* Uno\nx\nDos")).toEqual([
      { id: "c1", text: "Uno", required: true },
      { id: "c2", text: "Dos", required: false },
    ]);
  });
});
