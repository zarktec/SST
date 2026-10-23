import "server-only";
import { getRuntimeConfig } from "@/integrations/registry/service";
import {
  InvoicingError,
  type InvoiceLine,
  type InvoicingProvider,
  type IssuedDocument,
  type IssueInvoiceInput,
} from "../types";

type Fetch = typeof fetch;
export type SiigoCfg = {
  base: string;
  username: string;
  accessKey: string;
  partnerId: string;
  invoiceTypeId: number;
  creditNoteTypeId: number;
  sellerId: number;
  vatTaxId: number;
  paymentMethodId: number;
  productCode: string;
  costCenterId?: number;
  autoSendDian: boolean;
  sendEmail: boolean;
};

type SiigoDoc = {
  id?: string;
  name?: string;
  stamp?: { status?: string; cufe?: string; errors?: unknown };
  mail?: { status?: string };
  errors?: unknown;
};

const money = (cents: bigint) => Number(cents) / 100;

/** Estado DIAN de Siigo → estado normalizado. */
export function mapStamp(
  stamp: SiigoDoc["stamp"],
): Pick<IssuedDocument, "status" | "dianStatus" | "errors" | "cufe"> {
  const raw = String(stamp?.status ?? "");
  const errors = flattenErrors(stamp?.errors);
  const s = raw.toLowerCase();
  const status =
    s === "accepted"
      ? "accepted"
      : s === "rejected" || s === "error" || errors.length
        ? "rejected"
        : "issued";
  return { status, dianStatus: raw || null, errors, cufe: stamp?.cufe ?? null };
}

export function flattenErrors(e: unknown): string[] {
  if (!e) return [];
  if (typeof e === "string") return [e];
  if (Array.isArray(e)) return e.flatMap(flattenErrors);
  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    if (typeof o.Message === "string") return [o.Message];
    if (typeof o.message === "string") return [o.message];
    return Object.values(o).flatMap(flattenErrors);
  }
  return [String(e)];
}

/** Implementación de InvoicingProvider para Siigo (API v1). Credenciales: Centro de integraciones. */
export class SiigoProvider implements InvoicingProvider {
  readonly name = "siigo";
  private token: { value: string; exp: number } | null = null;
  constructor(
    private loadCfg: () => Promise<SiigoCfg>,
    private f: Fetch = fetch,
  ) {}

  static fromRegistry(f: Fetch = fetch): SiigoProvider {
    return new SiigoProvider(async () => {
      const rt = await getRuntimeConfig("siigo");
      if (!rt.enabled) throw new InvoicingError("La integración con Siigo no está activa", true);
      const c = rt.config;
      const need = {
        apiBaseUrl: c.apiBaseUrl,
        username: c.username,
        accessKey: rt.secrets.accessKey,
        partnerId: c.partnerId,
        invoiceTypeId: c.invoiceTypeId,
        sellerId: c.sellerId,
        vatTaxId: c.vatTaxId,
        paymentMethodId: c.paymentMethodId,
        productCode: c.productCode,
      };
      const missing = Object.entries(need)
        .filter(([, v]) => !v)
        .map(([k]) => k);
      if (missing.length)
        throw new InvoicingError(
          `Configuración de Siigo incompleta: falta ${missing.join(", ")}`,
          true,
        );
      return {
        base: String(c.apiBaseUrl).replace(/\/$/, ""),
        username: String(c.username),
        accessKey: String(rt.secrets.accessKey),
        partnerId: String(c.partnerId),
        invoiceTypeId: Number(c.invoiceTypeId),
        creditNoteTypeId: Number(c.creditNoteTypeId ?? 0),
        sellerId: Number(c.sellerId),
        vatTaxId: Number(c.vatTaxId),
        paymentMethodId: Number(c.paymentMethodId),
        productCode: String(c.productCode),
        costCenterId: c.costCenterId ? Number(c.costCenterId) : undefined,
        autoSendDian: c.autoSendDian !== false,
        sendEmail: c.sendEmail === true,
      };
    }, f);
  }

  private async auth(cfg: SiigoCfg): Promise<string> {
    if (this.token && this.token.exp > Date.now()) return this.token.value;
    const res = await this.f(`${cfg.base}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Partner-Id": cfg.partnerId },
      body: JSON.stringify({ username: cfg.username, access_key: cfg.accessKey }),
    });
    if (!res.ok)
      throw new InvoicingError(
        `Siigo rechazó la autenticación (HTTP ${res.status})`,
        res.status >= 500 || res.status === 429,
      );
    const body = (await res.json()) as { access_token?: string };
    if (!body.access_token) throw new InvoicingError("Siigo no devolvió access token", true);
    // El token dura 24 h; se renueva con margen.
    this.token = { value: body.access_token, exp: Date.now() + 23 * 3_600_000 };
    return body.access_token;
  }

  private async call<T>(
    cfg: SiigoCfg,
    path: string,
    init: RequestInit & { idempotencyKey?: string } = {},
    retryAuth = true,
  ): Promise<T> {
    const token = await this.auth(cfg);
    const { idempotencyKey, ...rest } = init;
    let res: Response;
    try {
      res = await this.f(`${cfg.base}${path}`, {
        ...rest,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Partner-Id": cfg.partnerId,
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
      });
    } catch (e) {
      throw new InvoicingError(
        `Sin conexión con Siigo: ${e instanceof Error ? e.message : e}`,
        true,
      );
    }
    if (res.status === 401 && retryAuth) {
      this.token = null;
      return this.call(cfg, path, init, false);
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as SiigoDoc | null;
      const details = flattenErrors(body?.errors ?? body);
      throw new InvoicingError(
        `Siigo respondió HTTP ${res.status}${details.length ? `: ${details.join("; ")}` : ""}`,
        res.status >= 500 || res.status === 429,
        details,
      );
    }
    return (await res.json()) as T;
  }

  /** Busca el cliente por identificación; si no existe lo crea. Devuelve la identificación a usar en la factura. */
  private async ensureCustomer(cfg: SiigoCfg, c: IssueInvoiceInput["customer"]) {
    const found = await this.call<{ results?: unknown[] }>(
      cfg,
      `/v1/customers?identification=${encodeURIComponent(c.identification)}`,
    );
    if (found.results?.length) return;
    const isCompany = c.personType === "Company";
    await this.call(cfg, "/v1/customers", {
      method: "POST",
      body: JSON.stringify({
        type: "Customer",
        person_type: c.personType,
        id_type: c.idType,
        identification: c.identification,
        ...(c.checkDigit ? { check_digit: c.checkDigit } : {}),
        name: isCompany ? [c.legalName] : [c.legalName, "."],
        commercial_name: c.legalName,
        vat_responsible: c.fiscalResponsibilities.includes("O-15"),
        fiscal_responsibilities: c.fiscalResponsibilities.map((code) => ({ code })),
        address: {
          address: c.address,
          city: { country_code: "Co", state_code: c.stateCode, city_code: c.cityCode },
          ...(c.postalCode ? { postal_code: c.postalCode } : {}),
        },
        phones: [{ number: c.phone }],
        contacts: [{ first_name: c.legalName.slice(0, 60), email: c.email }],
      }),
    });
  }

  private items(cfg: SiigoCfg, lines: InvoiceLine[]) {
    return lines.map((l) => ({
      code: cfg.productCode,
      description: l.description,
      quantity: 1,
      price: money(l.netCents),
      ...(l.vatRateBp > 0 ? { taxes: [{ id: cfg.vatTaxId }] } : {}),
    }));
  }

  private toDoc(d: SiigoDoc): IssuedDocument {
    return { providerId: String(d.id ?? ""), number: d.name ?? null, ...mapStamp(d.stamp) };
  }

  async issueInvoice(input: IssueInvoiceInput): Promise<IssuedDocument> {
    const cfg = await this.loadCfg();
    await this.ensureCustomer(cfg, input.customer);
    const doc = await this.call<SiigoDoc>(cfg, "/v1/invoices", {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      body: JSON.stringify({
        document: { id: cfg.invoiceTypeId },
        date: input.date,
        customer: {
          person_type: input.customer.personType,
          id_type: input.customer.idType,
          identification: input.customer.identification,
          branch_office: 0,
        },
        seller: cfg.sellerId,
        ...(cfg.costCenterId ? { cost_center: cfg.costCenterId } : {}),
        stamp: { send: cfg.autoSendDian },
        mail: { send: cfg.sendEmail },
        observations: input.reference,
        items: this.items(cfg, input.lines),
        payments: [
          { id: cfg.paymentMethodId, value: money(input.totalCents), due_date: input.date },
        ],
      }),
    });
    return this.toDoc(doc);
  }

  async getStatus(providerId: string): Promise<IssuedDocument> {
    const cfg = await this.loadCfg();
    return this.toDoc(await this.call<SiigoDoc>(cfg, `/v1/invoices/${providerId}`));
  }

  async getPdf(providerId: string): Promise<Buffer> {
    const cfg = await this.loadCfg();
    const r = await this.call<{ base64?: string }>(cfg, `/v1/invoices/${providerId}/pdf`);
    if (!r.base64) throw new InvoicingError("Siigo no devolvió el PDF", true);
    return Buffer.from(r.base64, "base64");
  }

  async issueCreditNote(
    input: Parameters<InvoicingProvider["issueCreditNote"]>[0],
  ): Promise<IssuedDocument> {
    const cfg = await this.loadCfg();
    if (!cfg.creditNoteTypeId)
      throw new InvoicingError(
        "Falta el ID del tipo de comprobante de nota crédito en la configuración de Siigo",
        false,
      );
    const doc = await this.call<SiigoDoc>(cfg, "/v1/credit-notes", {
      method: "POST",
      idempotencyKey: input.idempotencyKey,
      body: JSON.stringify({
        document: { id: cfg.creditNoteTypeId },
        date: input.date,
        invoice: input.invoiceProviderId,
        reason: "2", // TODO-NORMA: confirmar con contador el código DIAN del motivo (1 devolución, 2 anulación, 3 rebaja…)
        observations: input.reason,
        stamp: { send: cfg.autoSendDian },
        items: this.items(cfg, input.lines),
      }),
    });
    return this.toDoc(doc);
  }
}
