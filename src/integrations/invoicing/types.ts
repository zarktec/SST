/**
 * Interfaz de facturación electrónica. Hoy solo hay Siigo; el resto de la plataforma depende solo de esto.
 * Los estados DIAN se normalizan: accepted (aceptada), rejected (rechazada), issued (emitida sin respuesta aún).
 */
export type InvoiceCustomer = {
  personType: "Person" | "Company";
  idType: string;
  identification: string;
  checkDigit?: string | null;
  legalName: string;
  address: string;
  stateCode: string;
  cityCode: string;
  postalCode?: string | null;
  phone: string;
  email: string;
  fiscalResponsibilities: string[];
};

export type InvoiceLine = {
  description: string;
  /** Valor neto (sin IVA) en centavos. */
  netCents: bigint;
  /** Porcentaje de IVA aplicado en puntos básicos (1900 = 19 %); 0 si no aplica. */
  vatRateBp: number;
};

export type IssueInvoiceInput = {
  /** Idempotencia: la misma clave nunca genera dos facturas. */
  idempotencyKey: string;
  date: string;
  customer: InvoiceCustomer;
  lines: InvoiceLine[];
  totalCents: bigint;
  reference: string;
};

export type IssuedDocument = {
  providerId: string;
  number: string | null;
  cufe: string | null;
  status: "issued" | "accepted" | "rejected";
  dianStatus: string | null;
  errors: string[];
};

export interface InvoicingProvider {
  readonly name: string;
  issueInvoice(input: IssueInvoiceInput): Promise<IssuedDocument>;
  getStatus(providerId: string): Promise<IssuedDocument>;
  getPdf(providerId: string): Promise<Buffer>;
  issueCreditNote(input: {
    idempotencyKey: string;
    date: string;
    invoiceProviderId: string;
    reason: string;
    lines: InvoiceLine[];
  }): Promise<IssuedDocument>;
}

/** Error de la API del proveedor. `retryable` = vale la pena reintentar (red, 5xx, 429); si no, requiere intervención. */
export class InvoicingError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    public details: string[] = [],
  ) {
    super(message);
  }
}
