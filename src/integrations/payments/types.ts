/**
 * Interfaz de pasarela de pagos. Solo hay implementación de Wompi, pero el resto de la plataforma
 * depende únicamente de esta interfaz para poder cambiar de pasarela en el futuro (spec 5.2).
 */
export type PaymentStatus = "pending" | "approved" | "declined" | "voided" | "error";

export type AcceptanceTokens = {
  /** Términos y condiciones de la pasarela. */
  acceptanceToken: string;
  acceptanceUrl: string;
  /** Autorización de tratamiento de datos personales. */
  personalAuthToken: string;
  personalAuthUrl: string;
};

export type ProviderSource = {
  providerSourceId: string;
  type: "CARD" | "NEQUI";
  status: string;
};

export type ProviderTransaction = {
  providerTxId: string;
  reference: string;
  status: PaymentStatus;
  amountCents: bigint;
  message?: string;
};

export type ChargeInput = {
  /** Monto total (con IVA) en centavos. */
  amountCents: bigint;
  /** Referencia única por intento: la pasarela no admite repetidas. */
  reference: string;
  customerEmail: string;
  providerSourceId: string;
  /** Cobro periódico con el mismo monto (COF: mejora la tasa de aprobación). */
  recurrent: boolean;
};

export type VerifiedEvent = {
  /** Identificador estable para idempotencia (el checksum del evento). */
  eventKey: string;
  type: string;
  environment: string;
  transaction?: ProviderTransaction;
};

export interface PaymentProvider {
  readonly name: string;
  getAcceptanceTokens(): Promise<AcceptanceTokens>;
  createPaymentSource(input: {
    token: string;
    type: "CARD" | "NEQUI";
    customerEmail: string;
    acceptanceToken: string;
    personalAuthToken: string;
  }): Promise<ProviderSource>;
  charge(input: ChargeInput): Promise<ProviderTransaction>;
  getTransaction(providerTxId: string): Promise<ProviderTransaction>;
  /** Verifica la firma del webhook y lo normaliza. Devuelve null si la firma no es válida. */
  verifyEvent(body: unknown, headerChecksum?: string | null): Promise<VerifiedEvent | null>;
}
