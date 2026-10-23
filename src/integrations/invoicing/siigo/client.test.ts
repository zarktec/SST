import { describe, expect, it } from "vitest";
import { InvoicingError } from "../types";
import { SiigoProvider, mapStamp, type SiigoCfg } from "./client";

const cfg: SiigoCfg = {
  base: "https://siigo.test",
  username: "u",
  accessKey: "k",
  partnerId: "SST",
  invoiceTypeId: 1,
  creditNoteTypeId: 2,
  sellerId: 9,
  vatTaxId: 7,
  paymentMethodId: 5,
  productCode: "SUB",
  autoSendDian: true,
  sendEmail: false,
};
const customer = {
  personType: "Company" as const,
  idType: "31",
  identification: "900123456",
  checkDigit: "8",
  legalName: "ACME SAS",
  address: "Calle 1",
  stateCode: "11",
  cityCode: "11001",
  phone: "3001234567",
  email: "f@acme.co",
  fiscalResponsibilities: ["O-13"],
};
const input = {
  idempotencyKey: "invoice-p1",
  date: "2026-12-01",
  customer,
  lines: [{ description: "Suscripción", netCents: 20_000_000n, vatRateBp: 1900 }],
  totalCents: 23_800_000n,
  reference: "SUB-1",
};

type Call = { url: string; init: RequestInit };
function mock(routes: Record<string, (c: Call) => Response | Promise<Response>>) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const key = Object.keys(routes).find((k) =>
      `${init.method ?? "GET"} ${url.replace(cfg.base, "")}`.startsWith(k),
    );
    if (!key) throw new Error(`sin ruta ${init.method ?? "GET"} ${url}`);
    return routes[key]({ url, init });
  }) as unknown as typeof fetch;
  return { f, calls };
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const auth = { "POST /auth": () => json({ access_token: "tok" }) };

describe("Siigo", () => {
  it("mapea el estado DIAN", () => {
    expect(mapStamp({ status: "Accepted", cufe: "c" })).toMatchObject({
      status: "accepted",
      cufe: "c",
    });
    expect(mapStamp({ status: "Rejected", errors: [{ Message: "NIT inválido" }] })).toMatchObject({
      status: "rejected",
      errors: ["NIT inválido"],
    });
    expect(mapStamp({ status: "Pending" }).status).toBe("issued");
  });

  it("crea el cliente si no existe y emite con Idempotency-Key, montos en pesos e IVA", async () => {
    const { f, calls } = mock({
      ...auth,
      "GET /v1/customers": () => json({ results: [] }),
      "POST /v1/customers": () => json({ id: "c1" }, 201),
      "POST /v1/invoices": () =>
        json({ id: "inv1", name: "FV-1-100", stamp: { status: "Accepted", cufe: "abc" } }, 201),
    });
    const doc = await new SiigoProvider(async () => cfg, f).issueInvoice(input);
    expect(doc).toMatchObject({
      providerId: "inv1",
      number: "FV-1-100",
      cufe: "abc",
      status: "accepted",
    });
    const inv = calls.find((c) => c.url.endsWith("/v1/invoices"))!;
    expect((inv.init.headers as Record<string, string>)["Idempotency-Key"]).toBe("invoice-p1");
    expect((inv.init.headers as Record<string, string>)["Partner-Id"]).toBe("SST");
    const body = JSON.parse(String(inv.init.body));
    expect(body.items[0]).toMatchObject({ code: "SUB", price: 200000, taxes: [{ id: 7 }] });
    expect(body.payments[0].value).toBe(238000);
    expect(calls.some((c) => c.url.endsWith("/v1/customers") && c.init.method === "POST")).toBe(
      true,
    );
  });

  it("no recrea el cliente existente y reutiliza el token", async () => {
    const { f, calls } = mock({
      ...auth,
      "GET /v1/customers": () => json({ results: [{ id: "c1" }] }),
      "POST /v1/invoices": () => json({ id: "i", name: "FV-1", stamp: { status: "Pending" } }),
    });
    const p = new SiigoProvider(async () => cfg, f);
    await p.issueInvoice(input);
    await p.issueInvoice(input);
    expect(calls.filter((c) => c.url.endsWith("/auth"))).toHaveLength(1);
    expect(calls.some((c) => c.url.endsWith("/v1/customers") && c.init.method === "POST")).toBe(
      false,
    );
  });

  it("renueva el token ante 401 y distingue errores reintentables", async () => {
    let n = 0;
    const { f } = mock({
      ...auth,
      "GET /v1/customers": () => (n++ === 0 ? json({}, 401) : json({ results: [{}] })),
      "POST /v1/invoices": () => json({ errors: [{ Message: "Producto inexistente" }] }, 400),
    });
    await expect(new SiigoProvider(async () => cfg, f).issueInvoice(input)).rejects.toMatchObject({
      retryable: false,
      details: ["Producto inexistente"],
    });
    const { f: f2 } = mock({
      ...auth,
      "GET /v1/customers": () => json({ results: [{}] }),
      "POST /v1/invoices": () => json({}, 503),
    });
    await expect(new SiigoProvider(async () => cfg, f2).issueInvoice(input)).rejects.toMatchObject({
      retryable: true,
    });
  });

  it("descarga el PDF y emite notas crédito", async () => {
    const { f, calls } = mock({
      ...auth,
      "GET /v1/invoices/inv1/pdf": () => json({ base64: Buffer.from("%PDF-x").toString("base64") }),
      "POST /v1/credit-notes": () =>
        json({ id: "nc1", name: "NC-1", stamp: { status: "Accepted" } }),
    });
    const p = new SiigoProvider(async () => cfg, f);
    expect((await p.getPdf("inv1")).toString()).toBe("%PDF-x");
    const nc = await p.issueCreditNote({
      idempotencyKey: "credit-p1",
      date: "2026-12-02",
      invoiceProviderId: "inv1",
      reason: "Reembolso",
      lines: input.lines,
    });
    expect(nc.status).toBe("accepted");
    expect(JSON.parse(String(calls.at(-1)!.init.body))).toMatchObject({
      document: { id: 2 },
      invoice: "inv1",
    });
    await expect(
      new SiigoProvider(async () => ({ ...cfg, creditNoteTypeId: 0 }), f).issueCreditNote({
        idempotencyKey: "x",
        date: "d",
        invoiceProviderId: "i",
        reason: "r",
        lines: [],
      }),
    ).rejects.toBeInstanceOf(InvoicingError);
  });
});
