import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, schema, systemDb } from "@/core/db";
import { hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { devOutbox } from "@/core/mail";
import {
  InvoicingError,
  type InvoicingProvider,
  type IssuedDocument,
} from "@/integrations/invoicing/types";
import { chargeSubscription } from "./charging";
import {
  getBillingProfile,
  getInvoicePdf,
  invoiceApprovedPayment,
  issueCreditNote,
  listInvoices,
  processInvoice,
  reconcileInvoices,
  saveBillingProfile,
} from "./invoicing";
import { FakeProvider, d, setup } from "./test-helpers";

pointToTestDb();

class FakeInvoicing implements InvoicingProvider {
  readonly name = "fake";
  issued: string[] = [];
  script: (IssuedDocument | InvoicingError)[] = [];
  status: IssuedDocument["status"] = "accepted";
  async issueInvoice(i: Parameters<InvoicingProvider["issueInvoice"]>[0]) {
    this.issued.push(i.idempotencyKey);
    const n = this.script.shift();
    if (n instanceof Error) throw n;
    return (
      n ?? {
        providerId: `p-${i.idempotencyKey}`,
        number: "FV-1",
        cufe: "cufe",
        status: "issued" as const,
        dianStatus: "Pending",
        errors: [],
      }
    );
  }
  async getStatus(id: string): Promise<IssuedDocument> {
    return {
      providerId: id,
      number: "FV-1",
      cufe: "cufe",
      status: this.status,
      dianStatus: this.status,
      errors: this.status === "rejected" ? ["NIT inválido"] : [],
    };
  }
  async getPdf() {
    return Buffer.from("%PDF-1.4 fake");
  }
  async issueCreditNote(
    i: Parameters<InvoicingProvider["issueCreditNote"]>[0],
  ): Promise<IssuedDocument> {
    return {
      providerId: `nc-${i.idempotencyKey}`,
      number: "NC-1",
      cufe: "c2",
      status: "accepted",
      dianStatus: "Accepted",
      errors: [],
    };
  }
}

const profile = {
  personType: "Company" as const,
  idType: "31",
  identification: "900123456",
  checkDigit: "8",
  legalName: "ACME SAS",
  address: "Calle 1 # 2-3",
  stateCode: "11",
  cityCode: "11001",
  phone: "3001234567",
  invoiceEmail: "Fact@Acme.co",
  fiscalResponsibilities: ["O-13"],
  vatResponsible: true,
};

async function approvedPayment() {
  const { t } = await setup();
  await chargeSubscription(t.id, {
    reason: "trial_end",
    provider: new FakeProvider(["approved"]),
    now: d("2026-12-01T06:00:00Z"),
  });
  const [p] = await systemDb()
    .select()
    .from(schema.payment)
    .where(eq(schema.payment.tenantId, t.id));
  return { t, p };
}

describe.skipIf(!hasTestDb)("facturación electrónica", () => {
  afterAll(closeDb);
  beforeAll(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("guarda el perfil de facturación normalizado y rechaza datos inválidos", async () => {
    const { t } = await setup();
    expect(await getBillingProfile(t.id)).toBeNull();
    await saveBillingProfile(t.id, "u1", profile);
    expect(await getBillingProfile(t.id)).toMatchObject({
      invoiceEmail: "fact@acme.co",
      legalName: "ACME SAS",
    });
    await expect(saveBillingProfile(t.id, "u1", { ...profile, checkDigit: "1" })).rejects.toThrow();
  });

  it("factura un pago aprobado una sola vez (idempotente), guarda número, CUFE y PDF", async () => {
    const { t, p } = await approvedPayment();
    await saveBillingProfile(t.id, "u1", profile);
    const prov = new FakeInvoicing();
    await invoiceApprovedPayment(p, prov);
    await invoiceApprovedPayment(p, prov);
    expect(prov.issued).toEqual([`invoice-${p.id}`]);
    const [inv] = await listInvoices(t.id);
    expect(inv).toMatchObject({ number: "FV-1", status: "issued", kind: "invoice" });
    expect((await getInvoicePdf(t.id, inv.id))?.pdf.toString()).toContain("%PDF");
    // La conciliación consulta la DIAN y pasa a aceptada.
    expect(await reconcileInvoices(prov)).toContainEqual({ id: inv.id, status: "accepted" });
  });

  it("sin perfil de facturación queda en error, avisa a la empresa y se emite al completar el perfil", async () => {
    const { t, p } = await approvedPayment();
    const prov = new FakeInvoicing();
    await invoiceApprovedPayment(p, prov);
    expect((await listInvoices(t.id))[0].status).toBe("error");
    expect(prov.issued).toHaveLength(0);
    await saveBillingProfile(t.id, "u1", profile);
    const [inv] = await listInvoices(t.id);
    const later = new Date(Date.now() + 2 * 86_400_000);
    expect((await reconcileInvoices(prov, later)).find((r) => r.id === inv.id)?.status).toBe(
      "issued",
    );
  });

  it("reintenta con backoff ante fallos transitorios y alerta si el error no es reintentable", async () => {
    const { t, p } = await approvedPayment();
    await saveBillingProfile(t.id, "u1", profile);
    const prov = new FakeInvoicing();
    prov.script = [new InvoicingError("timeout", true)];
    await invoiceApprovedPayment(p, prov);
    const [row] = await systemDb()
      .select()
      .from(schema.invoice)
      .where(eq(schema.invoice.tenantId, t.id));
    expect(row).toMatchObject({ status: "pending", attempts: 1 });
    expect(row.nextRetryAt!.getTime()).toBeGreaterThan(Date.now());
    expect(prov.issued).toHaveLength(1);
    expect((await reconcileInvoices(prov)).filter((r) => r.id === row.id)).toEqual([]); // aún no toca
    const out = await reconcileInvoices(prov, new Date(Date.now() + 3_600_000));
    expect(out.find((r) => r.id === row.id)?.status).toBe("issued");
    expect(new Set(prov.issued).size).toBe(1); // misma clave de idempotencia

    const b = await approvedPayment();
    await saveBillingProfile(b.t.id, "u1", profile);
    prov.script = [new InvoicingError("Producto inexistente", false)];
    devOutbox.length = 0;
    await invoiceApprovedPayment(b.p, prov);
    expect((await listInvoices(b.t.id))[0].status).toBe("error");
  });

  it("una factura rechazada por la DIAN queda marcada con sus errores", async () => {
    const { t, p } = await approvedPayment();
    await saveBillingProfile(t.id, "u1", profile);
    const prov = new FakeInvoicing();
    prov.script = [
      {
        providerId: "x",
        number: "FV-9",
        cufe: null,
        status: "rejected",
        dianStatus: "Rejected",
        errors: ["NIT inválido"],
      },
    ];
    await invoiceApprovedPayment(p, prov);
    const [row] = await systemDb()
      .select()
      .from(schema.invoice)
      .where(eq(schema.invoice.tenantId, t.id));
    expect(row).toMatchObject({ status: "rejected", errors: ["NIT inválido"] });
    // No se reprocesa solo.
    expect((await processInvoice(row.id, prov)).status).toBe("rejected");
  });

  it("emite nota crédito sobre una factura emitida, una sola por pago", async () => {
    const { t, p } = await approvedPayment();
    await saveBillingProfile(t.id, "u1", profile);
    const prov = new FakeInvoicing();
    await invoiceApprovedPayment(p, prov);
    const [inv] = await listInvoices(t.id);
    const nc = await issueCreditNote(inv.id, "Reembolso", "admin1", prov);
    expect(nc).toMatchObject({ kind: "credit_note", status: "accepted", refInvoiceId: inv.id });
    await expect(issueCreditNote(inv.id, "Otra vez", "admin1", prov)).rejects.toThrow(/Ya existe/);
  });
});
