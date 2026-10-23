export type Env = "sandbox" | "production";

export type FieldDef = {
  name: string;
  label: string;
  /** `secret` se guarda cifrado y nunca se devuelve al navegador. */
  kind: "config" | "secret";
  type?: "text" | "url" | "boolean" | "number" | "select";
  options?: { value: string; label: string }[];
  required?: boolean;
  help?: string;
  /** Valor por defecto por ambiente (solo config). */
  defaults?: Partial<Record<Env, string | boolean | number>>;
  /** Llave pública pensada para usarse en el navegador (única excepción permitida). */
  clientSafe?: boolean;
  /** Los secretos con vencimiento alertan antes de expirar (p. ej. Microsoft). */
  hasExpiry?: boolean;
};

export type TestContext = {
  env: Env;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
  fetch: typeof fetch;
};
export type TestResult = { ok: boolean; message: string };

export type IntegrationDef = {
  key: IntegrationKey;
  label: string;
  description: string;
  fields: FieldDef[];
  /** Campos requeridos adicionales para considerar la integración "configurada". */
  test: (ctx: TestContext) => Promise<TestResult>;
  /** Texto de ayuda con instrucciones (URLs de redirección, webhook, etc.). Se calcula en servidor. */
  helpers?: (rootDomain: string) => { label: string; value: string }[];
};

export const INTEGRATION_KEYS = ["wompi", "siigo", "auco", "google", "microsoft"] as const;
export type IntegrationKey = (typeof INTEGRATION_KEYS)[number];
