import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  checksumsMatch,
  eventChecksum,
  integritySignature,
  verifyWompiEvent,
  type WompiEvent,
} from "./signature";

// Vectores de la documentación oficial de Wompi (docs.wompi.co).
//  - Firma de integridad: el hash del ejemplo coincide con el algoritmo documentado.
//  - Eventos: el ejemplo de la documentación concatena "1234-1610641025-49201APPROVED44900001530291411" + secreto, pero el
//    hash que publica (3476DDA5…) NO corresponde a esa cadena (su SHA256 real es 5A18EC5E…). Se implementa el algoritmo
//    documentado; se validará contra eventos reales del sandbox en las pruebas de integración finales.
const SECRET = "prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z";
const event: WompiEvent = {
  event: "transaction.updated",
  data: {
    transaction: {
      id: "1234-1610641025-49201",
      amount_in_cents: 4490000,
      reference: "MZQ3X2DE2SMX",
      customer_email: "juan.perez@gmail.com",
      currency: "COP",
      payment_method_type: "NEQUI",
      status: "APPROVED",
    },
  },
  environment: "prod",
  signature: {
    properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
    checksum: "5A18EC5E8FDB7DF463E9F94774CBA8F583BA21BD04A09CEFF2EA68A4BC0AEFBE",
  },
  timestamp: 1530291411,
  sent_at: "2018-07-20T16:45:05.000Z",
};

describe("firma de integridad", () => {
  it("coincide con el ejemplo oficial", () => {
    expect(
      integritySignature(
        "sk8-438k4-xmxm392-sn2m",
        2490000,
        "COP",
        "prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6",
      ),
    ).toBe("37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5");
  });
  it("acepta bigint y number", () => {
    expect(integritySignature("r", 100n, "COP", "s")).toBe(
      integritySignature("r", 100, "COP", "s"),
    );
  });
  it("cualquier cambio de monto, referencia o moneda cambia la firma", () => {
    const base = integritySignature("r", 100, "COP", "s");
    expect(integritySignature("r", 101, "COP", "s")).not.toBe(base);
    expect(integritySignature("r2", 100, "COP", "s")).not.toBe(base);
    expect(integritySignature("r", 100, "USD", "s")).not.toBe(base);
  });
});

describe("checksum de eventos", () => {
  it("sigue el algoritmo documentado: SHA256(valores + timestamp + secreto)", () => {
    expect(eventChecksum(event, SECRET)?.toUpperCase()).toBe(
      "5A18EC5E8FDB7DF463E9F94774CBA8F583BA21BD04A09CEFF2EA68A4BC0AEFBE",
    );
    expect(
      createHash("sha256")
        .update(`1234-1610641025-49201APPROVED44900001530291411${SECRET}`)
        .digest("hex"),
    ).toBe(eventChecksum(event, SECRET));
  });
  it("verifica eventos auténticos (mayúsculas/minúsculas indiferentes) y el encabezado", () => {
    expect(verifyWompiEvent(event, SECRET)).toBe(true);
    expect(verifyWompiEvent(event, SECRET, event.signature!.checksum!.toLowerCase())).toBe(true);
  });
  it("rechaza secreto equivocado, vacío o encabezado distinto", () => {
    expect(verifyWompiEvent(event, "otro-secreto")).toBe(false);
    expect(verifyWompiEvent(event, "")).toBe(false);
    expect(verifyWompiEvent(event, SECRET, "0".repeat(64))).toBe(false);
  });
  it("rechaza si se altera el estado, el monto o el timestamp (suplantación)", () => {
    const tx = event.data.transaction as Record<string, unknown>;
    expect(
      verifyWompiEvent({ ...event, data: { transaction: { ...tx, status: "DECLINED" } } }, SECRET),
    ).toBe(false);
    expect(
      verifyWompiEvent({ ...event, data: { transaction: { ...tx, amount_in_cents: 1 } } }, SECRET),
    ).toBe(false);
    expect(verifyWompiEvent({ ...event, timestamp: 1530291412 }, SECRET)).toBe(false);
  });
  it("rechaza eventos sin firma, sin propiedades o con propiedades ausentes", () => {
    expect(verifyWompiEvent({ ...event, signature: undefined }, SECRET)).toBe(false);
    expect(
      verifyWompiEvent({ ...event, signature: { properties: [], checksum: "x" } }, SECRET),
    ).toBe(false);
    expect(
      verifyWompiEvent(
        { ...event, signature: { properties: ["transaction.nope"], checksum: "x" } },
        SECRET,
      ),
    ).toBe(false);
    expect(verifyWompiEvent({ ...event, timestamp: undefined }, SECRET)).toBe(false);
  });
  it("usa las propiedades del propio evento, no una lista fija", () => {
    const ev: WompiEvent = {
      ...event,
      signature: {
        properties: ["transaction.id", "transaction.reference", "transaction.status"],
        checksum: "",
      },
    };
    const sum = eventChecksum(ev, SECRET)!;
    expect(verifyWompiEvent({ ...ev, signature: { ...ev.signature, checksum: sum } }, SECRET)).toBe(
      true,
    );
    expect(sum.toUpperCase()).not.toBe(event.signature!.checksum);
  });
  it("comparación de hashes de distinta longitud no lanza", () => {
    expect(checksumsMatch("abc", "abcd")).toBe(false);
  });
});
