import { describe, expect, it } from "vitest";
import { integritySignature, eventChecksum, type WompiEvent } from "./signature";
import { mapStatus, WompiError, WompiProvider } from "./client";

const cfg = {
  base: "https://sandbox.wompi.co/v1",
  publicKey: "pub_test_1",
  privateKey: "prv_test_1",
  integritySecret: "test_integrity_1",
  eventsSecret: "test_events_1",
};

type Call = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: Record<string, unknown>;
};
function fake(routes: Record<string, { status: number; body: unknown }>) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      method: init.method ?? "GET",
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    });
    const key = Object.keys(routes).find((k) => url.endsWith(k));
    const r = key ? routes[key] : { status: 404, body: {} };
    return new Response(JSON.stringify(r.body), { status: r.status });
  }) as unknown as typeof fetch;
  return { f, calls, provider: new WompiProvider(async () => cfg, f) };
}

describe("estados de la pasarela", () => {
  it("mapea los estados de Wompi", () => {
    expect([
      mapStatus("PENDING"),
      mapStatus("APPROVED"),
      mapStatus("DECLINED"),
      mapStatus("VOIDED"),
      mapStatus("ERROR"),
    ]).toEqual(["pending", "approved", "declined", "voided", "error"]);
    expect(mapStatus("algo-raro")).toBe("error");
  });
});

describe("WompiProvider", () => {
  it("obtiene los tokens de aceptación con la llave pública", async () => {
    const { provider, calls } = fake({
      "/merchants/pub_test_1": {
        status: 200,
        body: {
          data: {
            presigned_acceptance: {
              acceptance_token: "acc_1",
              permalink: "https://wompi.co/terminos.pdf",
            },
            presigned_personal_data_auth: {
              acceptance_token: "auth_1",
              permalink: "https://wompi.co/datos.pdf",
            },
          },
        },
      },
    });
    expect(await provider.getAcceptanceTokens()).toEqual({
      acceptanceToken: "acc_1",
      acceptanceUrl: "https://wompi.co/terminos.pdf",
      personalAuthToken: "auth_1",
      personalAuthUrl: "https://wompi.co/datos.pdf",
    });
    expect(calls[0].headers.Authorization).toBe("Bearer pub_test_1");
  });

  it("crea la fuente de pago con la llave PRIVADA y los dos tokens de aceptación", async () => {
    const { provider, calls } = fake({
      "/payment_sources": {
        status: 201,
        body: { data: { id: 3891, type: "CARD", status: "AVAILABLE" } },
      },
    });
    const s = await provider.createPaymentSource({
      token: "tok_test_1",
      type: "CARD",
      customerEmail: "a@b.co",
      acceptanceToken: "acc_1",
      personalAuthToken: "auth_1",
    });
    expect(s).toEqual({ providerSourceId: "3891", type: "CARD", status: "AVAILABLE" });
    expect(calls[0]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer prv_test_1" }),
    });
    expect(calls[0].body).toEqual({
      type: "CARD",
      token: "tok_test_1",
      customer_email: "a@b.co",
      acceptance_token: "acc_1",
      accept_personal_auth: "auth_1",
    });
  });

  it("rechaza una fuente que no queda AVAILABLE y propaga el motivo de la pasarela", async () => {
    const declined = fake({
      "/payment_sources": {
        status: 201,
        body: { data: { id: 1, type: "CARD", status: "PENDING" } },
      },
    });
    await expect(
      declined.provider.createPaymentSource({
        token: "t",
        type: "CARD",
        customerEmail: "a@b.co",
        acceptanceToken: "a",
        personalAuthToken: "b",
      }),
    ).rejects.toThrow(/PENDING/);
    const err = fake({
      "/payment_sources": {
        status: 422,
        body: { error: { type: "UNPROCESSABLE", reason: "La fuente de pago ha sido declinada" } },
      },
    });
    await expect(
      err.provider.createPaymentSource({
        token: "t",
        type: "CARD",
        customerEmail: "a@b.co",
        acceptanceToken: "a",
        personalAuthToken: "b",
      }),
    ).rejects.toThrow("La fuente de pago ha sido declinada");
  });

  it("cobra con fuente de pago: monto entero en centavos, firma de integridad, COP y recurrente", async () => {
    const { provider, calls } = fake({
      "/transactions": {
        status: 201,
        body: {
          data: {
            id: "1292-1-1",
            reference: "SUB-1-20261201",
            status: "PENDING",
            amount_in_cents: 23800000,
          },
        },
      },
    });
    const tx = await provider.charge({
      amountCents: 23_800_000n,
      reference: "SUB-1-20261201",
      customerEmail: "a@b.co",
      providerSourceId: "3891",
      recurrent: true,
    });
    expect(tx).toEqual({
      providerTxId: "1292-1-1",
      reference: "SUB-1-20261201",
      status: "pending",
      amountCents: 23_800_000n,
      message: undefined,
    });
    expect(calls[0].body).toEqual({
      amount_in_cents: 23_800_000,
      currency: "COP",
      customer_email: "a@b.co",
      reference: "SUB-1-20261201",
      payment_source_id: 3891,
      payment_method: { installments: 1 },
      recurrent: true,
      signature: integritySignature("SUB-1-20261201", 23_800_000, "COP", cfg.integritySecret),
    });
    expect(Number.isInteger(calls[0].body!.amount_in_cents)).toBe(true);
  });

  it("sin recurrente no envía el campo; montos fuera de rango se rechazan", async () => {
    const { provider, calls } = fake({
      "/transactions": {
        status: 201,
        body: { data: { id: "x", reference: "r", status: "APPROVED", amount_in_cents: 100 } },
      },
    });
    await provider.charge({
      amountCents: 100n,
      reference: "r",
      customerEmail: "a@b.co",
      providerSourceId: "1",
      recurrent: false,
    });
    expect(calls[0].body).not.toHaveProperty("recurrent");
    await expect(
      provider.charge({
        amountCents: 2n ** 60n,
        reference: "r2",
        customerEmail: "a@b.co",
        providerSourceId: "1",
        recurrent: true,
      }),
    ).rejects.toThrow(/fuera de rango/);
  });

  it("referencia duplicada (422) se informa con el mensaje de la pasarela", async () => {
    const { provider } = fake({
      "/transactions": {
        status: 422,
        body: {
          error: {
            type: "INPUT_VALIDATION_ERROR",
            messages: { reference: ["La referencia ya ha sido usada"] },
          },
        },
      },
    });
    const e = await provider
      .charge({
        amountCents: 100n,
        reference: "r",
        customerEmail: "a@b.co",
        providerSourceId: "1",
        recurrent: true,
      })
      .catch((x) => x);
    expect(e).toBeInstanceOf(WompiError);
    expect(e.message).toBe("La referencia ya ha sido usada");
    expect(e.status).toBe(422);
  });

  it("consulta una transacción con la llave privada", async () => {
    const { provider, calls } = fake({
      "/transactions/1292-1-1": {
        status: 200,
        body: {
          data: { id: "1292-1-1", reference: "r", status: "APPROVED", amount_in_cents: 5000 },
        },
      },
    });
    expect(await provider.getTransaction("1292-1-1")).toMatchObject({
      status: "approved",
      amountCents: 5000n,
    });
    expect(calls[0].headers.Authorization).toBe("Bearer prv_test_1");
  });

  it("verifica y normaliza eventos transaction.updated; rechaza los falsificados", async () => {
    const { provider } = fake({});
    const ev: WompiEvent = {
      event: "transaction.updated",
      environment: "test",
      timestamp: 1700000000,
      data: {
        transaction: {
          id: "t-1",
          reference: "SUB-9-20261201",
          status: "DECLINED",
          amount_in_cents: 23800000,
          status_message: "Fondos insuficientes",
        },
      },
      signature: {
        properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
        checksum: "",
      },
    };
    ev.signature!.checksum = eventChecksum(ev, cfg.eventsSecret)!.toUpperCase();
    const ok = await provider.verifyEvent(ev, ev.signature!.checksum);
    expect(ok).toMatchObject({
      type: "transaction.updated",
      environment: "test",
      eventKey: ev.signature!.checksum!.toLowerCase(),
      transaction: {
        providerTxId: "t-1",
        status: "declined",
        amountCents: 23_800_000n,
        message: "Fondos insuficientes",
      },
    });
    const tampered = {
      ...ev,
      data: { transaction: { ...(ev.data.transaction as object), status: "APPROVED" } },
    };
    expect(await provider.verifyEvent(tampered)).toBeNull();
    expect(await provider.verifyEvent("no es un evento")).toBeNull();
    expect(await provider.verifyEvent({ event: "x" })).toBeNull();
  });
});
