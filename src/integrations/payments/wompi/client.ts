import "server-only";
import { getRuntimeConfig } from "@/integrations/registry/service";
import type {
  AcceptanceTokens,
  ChargeInput,
  PaymentProvider,
  PaymentStatus,
  ProviderSource,
  ProviderTransaction,
  VerifiedEvent,
} from "../types";
import { integritySignature, verifyWompiEvent, type WompiEvent } from "./signature";

type Fetch = typeof fetch;
type Cfg = {
  base: string;
  publicKey: string;
  privateKey: string;
  integritySecret: string;
  eventsSecret: string;
};

const STATUS: Record<string, PaymentStatus> = {
  PENDING: "pending",
  APPROVED: "approved",
  DECLINED: "declined",
  VOIDED: "voided",
  ERROR: "error",
};
export const mapStatus = (s: unknown): PaymentStatus => STATUS[String(s).toUpperCase()] ?? "error";

export class WompiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

type WompiTx = {
  id?: string;
  reference?: string;
  status?: string;
  amount_in_cents?: number | string;
  status_message?: string | null;
};
const toTx = (t: WompiTx): ProviderTransaction => ({
  providerTxId: String(t.id ?? ""),
  reference: String(t.reference ?? ""),
  status: mapStatus(t.status),
  amountCents: BigInt(t.amount_in_cents ?? 0),
  message: t.status_message ?? undefined,
});

/** Implementación de PaymentProvider para Wompi (API v1). Credenciales y ambiente: Centro de integraciones. */
export class WompiProvider implements PaymentProvider {
  readonly name = "wompi";
  constructor(
    private loadCfg: () => Promise<Cfg>,
    private f: Fetch = fetch,
  ) {}

  /** Lee las credenciales del ambiente activo desde el Centro de integraciones. */
  static fromRegistry(f: Fetch = fetch): WompiProvider {
    return new WompiProvider(async () => {
      const rt = await getRuntimeConfig("wompi");
      if (!rt.enabled) throw new WompiError("La integración con Wompi no está activa");
      const base = String(rt.config.apiBaseUrl ?? "").replace(/\/$/, "");
      const need = {
        publicKey: rt.config.publicKey,
        privateKey: rt.secrets.privateKey,
        integritySecret: rt.secrets.integritySecret,
        eventsSecret: rt.secrets.eventsSecret,
      };
      const missing = Object.entries({ base, ...need })
        .filter(([, v]) => !v)
        .map(([k]) => k);
      if (missing.length)
        throw new WompiError(`Configuración de Wompi incompleta: falta ${missing.join(", ")}`);
      return {
        base,
        publicKey: String(need.publicKey),
        privateKey: need.privateKey,
        integritySecret: need.integritySecret,
        eventsSecret: need.eventsSecret,
      };
    }, f);
  }

  private async call<T>(
    cfg: Cfg,
    method: "GET" | "POST",
    path: string,
    auth: "public" | "private",
    body?: unknown,
  ): Promise<T> {
    const res = await this.f(`${cfg.base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${auth === "public" ? cfg.publicKey : cfg.privateKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: unknown;
      error?: { type?: string; reason?: string; messages?: Record<string, string[]> };
    };
    if (!res.ok) {
      const messages = json.error?.messages
        ? Object.values(json.error.messages).flat().join("; ")
        : "";
      throw new WompiError(
        json.error?.reason ?? (messages || `Wompi respondió ${res.status}`),
        res.status,
      );
    }
    return json as T;
  }

  async getAcceptanceTokens(): Promise<AcceptanceTokens> {
    const cfg = await this.loadCfg();
    const r = await this.call<{
      data: {
        presigned_acceptance?: { acceptance_token: string; permalink: string };
        presigned_personal_data_auth?: { acceptance_token: string; permalink: string };
      };
    }>(cfg, "GET", `/merchants/${encodeURIComponent(cfg.publicKey)}`, "public");
    const a = r.data.presigned_acceptance;
    const p = r.data.presigned_personal_data_auth;
    if (!a || !p) throw new WompiError("Wompi no devolvió los tokens de aceptación");
    return {
      acceptanceToken: a.acceptance_token,
      acceptanceUrl: a.permalink,
      personalAuthToken: p.acceptance_token,
      personalAuthUrl: p.permalink,
    };
  }

  async createPaymentSource(input: {
    token: string;
    type: "CARD" | "NEQUI";
    customerEmail: string;
    acceptanceToken: string;
    personalAuthToken: string;
  }): Promise<ProviderSource> {
    const cfg = await this.loadCfg();
    const r = await this.call<{ data: { id: number | string; type: string; status: string } }>(
      cfg,
      "POST",
      "/payment_sources",
      "private",
      {
        type: input.type,
        token: input.token,
        customer_email: input.customerEmail,
        acceptance_token: input.acceptanceToken,
        accept_personal_auth: input.personalAuthToken,
      },
    );
    if (r.data.status !== "AVAILABLE")
      throw new WompiError(`La fuente de pago no quedó disponible (${r.data.status})`);
    return { providerSourceId: String(r.data.id), type: input.type, status: r.data.status };
  }

  async charge(input: ChargeInput): Promise<ProviderTransaction> {
    const cfg = await this.loadCfg();
    const body = {
      amount_in_cents: Number(input.amountCents), // montos < 2^53 centavos; se mantienen enteros
      currency: "COP",
      signature: integritySignature(input.reference, input.amountCents, "COP", cfg.integritySecret),
      customer_email: input.customerEmail,
      reference: input.reference,
      payment_source_id: Number(input.providerSourceId),
      payment_method: { installments: 1 },
      ...(input.recurrent ? { recurrent: true } : {}),
    };
    if (!Number.isSafeInteger(body.amount_in_cents)) throw new WompiError("Monto fuera de rango");
    const r = await this.call<{ data: WompiTx }>(cfg, "POST", "/transactions", "private", body);
    return toTx(r.data);
  }

  async getTransaction(providerTxId: string): Promise<ProviderTransaction> {
    const cfg = await this.loadCfg();
    const r = await this.call<{ data: WompiTx }>(
      cfg,
      "GET",
      `/transactions/${encodeURIComponent(providerTxId)}`,
      "private",
    );
    return toTx(r.data);
  }

  async verifyEvent(body: unknown, headerChecksum?: string | null): Promise<VerifiedEvent | null> {
    const cfg = await this.loadCfg();
    const ev = body as WompiEvent;
    if (
      !ev ||
      typeof ev !== "object" ||
      typeof ev.event !== "string" ||
      !verifyWompiEvent(ev, cfg.eventsSecret, headerChecksum)
    )
      return null;
    const out: VerifiedEvent = {
      eventKey: String(ev.signature?.checksum).toLowerCase(),
      type: ev.event,
      environment: String(ev.environment ?? ""),
    };
    const tx = (ev.data as { transaction?: WompiTx } | undefined)?.transaction;
    if (ev.event === "transaction.updated" && tx) out.transaction = toTx(tx);
    return out;
  }
}
