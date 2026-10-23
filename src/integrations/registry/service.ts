import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { decrypt, encrypt, maskSecret } from "@/core/crypto/envelope";
import { schema, systemDb } from "@/core/db";
import { DEFINITIONS, getDefinition } from "./definitions";
import {
  INTEGRATION_KEYS,
  type Env,
  type FieldDef,
  type IntegrationKey,
  type TestResult,
} from "./types";

/**
 * Centro de integraciones. Las funciones de este módulo NO validan permisos: quien las llama
 * (acciones del panel SUPER ADMIN) debe haber verificado el rol. Los secretos solo se descifran
 * en `getRuntimeConfig`/`testConnection`, nunca se devuelven a la UI (solo `mask`).
 */

const { integration, integrationConfig, integrationSecret, integrationChangeLog } = schema;

const CACHE_TTL_MS = 30_000;
type Runtime = {
  env: Env;
  enabled: boolean;
  config: Record<string, unknown>;
  secrets: Record<string, string>;
};
const cache = new Map<string, { at: number; value: Runtime }>();

export function invalidateIntegrationCache(key?: string) {
  if (!key) return cache.clear();
  for (const k of [...cache.keys()]) if (k.startsWith(`${key}:`)) cache.delete(k);
}

const aad = (key: string, env: Env, name: string) => `integration:${key}:${env}:${name}`;

export async function ensureIntegrations() {
  const db = systemDb();
  await db
    .insert(integration)
    .values(INTEGRATION_KEYS.map((key) => ({ key })))
    .onConflictDoNothing();
}

async function getRow(key: IntegrationKey) {
  await ensureIntegrations();
  const [row] = await systemDb().select().from(integration).where(eq(integration.key, key));
  return row;
}

async function log(
  integrationId: string,
  env: Env | null,
  field: string,
  action: string,
  actorId?: string,
) {
  await systemDb()
    .insert(integrationChangeLog)
    .values({ integrationId, env, field, action, actorId });
}

function coerce(field: FieldDef, raw: unknown): string | number | boolean | undefined {
  if (raw === "" || raw === null || raw === undefined) return undefined;
  switch (field.type) {
    case "url":
      return z.url().parse(raw);
    case "number":
      return z.coerce.number().int().parse(raw);
    case "boolean":
      return z.coerce.boolean().parse(raw);
    case "select": {
      const v = z.string().parse(raw);
      if (!field.options?.some((o) => o.value === v))
        throw new Error(`Valor inválido para ${field.label}`);
      return v;
    }
    default:
      return z.string().trim().max(500).parse(raw);
  }
}

async function loadConfigValues(integrationId: string, env: Env): Promise<Record<string, unknown>> {
  const [row] = await systemDb()
    .select()
    .from(integrationConfig)
    .where(and(eq(integrationConfig.integrationId, integrationId), eq(integrationConfig.env, env)));
  return row?.values ?? {};
}

export type FieldView = {
  name: string;
  label: string;
  kind: "config" | "secret";
  type: string;
  required: boolean;
  help?: string;
  options?: { value: string; label: string }[];
  hasExpiry: boolean;
  /** Config: valor actual (o por defecto). Secret: siempre undefined. */
  value?: string | number | boolean;
  /** Secret: valor enmascarado. */
  mask?: string;
  expiresAt?: Date | null;
};

export type IntegrationView = {
  key: IntegrationKey;
  label: string;
  description: string;
  enabled: boolean;
  activeEnv: Env;
  lastTestAt: Date | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  consecutiveFailures: number;
  helpers: { label: string; value: string }[];
  envs: Record<Env, FieldView[]>;
};

export async function getIntegrationView(
  key: IntegrationKey,
  rootDomain: string,
): Promise<IntegrationView> {
  const def = getDefinition(key);
  const row = await getRow(key);
  const secrets = await systemDb()
    .select()
    .from(integrationSecret)
    .where(eq(integrationSecret.integrationId, row.id));
  const envs = {} as Record<Env, FieldView[]>;
  for (const env of ["sandbox", "production"] as const) {
    const values = await loadConfigValues(row.id, env);
    envs[env] = def.fields.map((f) => {
      const base: FieldView = {
        name: f.name,
        label: f.label,
        kind: f.kind,
        type: f.type ?? "text",
        required: Boolean(f.required),
        help: f.help,
        options: f.options,
        hasExpiry: Boolean(f.hasExpiry),
      };
      if (f.kind === "config") {
        base.value = (values[f.name] as FieldView["value"]) ?? f.defaults?.[env];
      } else {
        const s = secrets.find((x) => x.env === env && x.name === f.name);
        base.mask = s?.mask;
        base.expiresAt = s?.expiresAt;
      }
      return base;
    });
  }
  return {
    key,
    label: def.label,
    description: def.description,
    enabled: row.enabled,
    activeEnv: row.activeEnv,
    lastTestAt: row.lastTestAt,
    lastTestOk: row.lastTestOk,
    lastTestMessage: row.lastTestMessage,
    consecutiveFailures: row.consecutiveFailures,
    helpers: def.helpers?.(rootDomain) ?? [],
    envs,
  };
}

export async function saveConfig(
  key: IntegrationKey,
  env: Env,
  input: Record<string, unknown>,
  actorId: string,
) {
  const def = getDefinition(key);
  const row = await getRow(key);
  const current = await loadConfigValues(row.id, env);
  const next = { ...current };
  const changed: string[] = [];
  for (const field of def.fields.filter((f) => f.kind === "config")) {
    if (!(field.name in input)) continue;
    const v = coerce(field, input[field.name]);
    if (v === undefined) delete next[field.name];
    else next[field.name] = v;
    if (current[field.name] !== next[field.name]) changed.push(field.name);
  }
  await systemDb()
    .insert(integrationConfig)
    .values({ integrationId: row.id, env, values: next })
    .onConflictDoUpdate({
      target: [integrationConfig.integrationId, integrationConfig.env],
      set: { values: next, updatedAt: new Date() },
    });
  for (const f of changed) await log(row.id, env, f, "config_updated", actorId);
  invalidateIntegrationCache(key);
  return changed;
}

export async function setSecret(
  key: IntegrationKey,
  env: Env,
  name: string,
  value: string,
  opts: { expiresAt?: Date | null; actorId: string },
) {
  const def = getDefinition(key);
  const field = def.fields.find((f) => f.kind === "secret" && f.name === name);
  if (!field) throw new Error(`${name} no es un secreto de ${key}`);
  const trimmed = value.trim();
  if (trimmed.length < 4) throw new Error("El secreto es demasiado corto");
  const row = await getRow(key);
  const encrypted = encrypt(trimmed, aad(key, env, name));
  const mask = maskSecret(trimmed);
  const expiresAt = field.hasExpiry ? (opts.expiresAt ?? null) : null;
  await systemDb()
    .insert(integrationSecret)
    .values({
      integrationId: row.id,
      env,
      name,
      encrypted,
      mask,
      expiresAt,
      updatedBy: opts.actorId,
    })
    .onConflictDoUpdate({
      target: [integrationSecret.integrationId, integrationSecret.env, integrationSecret.name],
      set: { encrypted, mask, expiresAt, updatedBy: opts.actorId, updatedAt: new Date() },
    });
  await log(row.id, env, name, "secret_replaced", opts.actorId);
  invalidateIntegrationCache(key);
  return mask;
}

export async function clearSecret(key: IntegrationKey, env: Env, name: string, actorId: string) {
  const row = await getRow(key);
  await systemDb()
    .delete(integrationSecret)
    .where(
      and(
        eq(integrationSecret.integrationId, row.id),
        eq(integrationSecret.env, env),
        eq(integrationSecret.name, name),
      ),
    );
  await log(row.id, env, name, "secret_removed", actorId);
  invalidateIntegrationCache(key);
}

export async function setActiveEnv(key: IntegrationKey, env: Env, actorId: string) {
  const row = await getRow(key);
  await systemDb()
    .update(integration)
    .set({ activeEnv: env, updatedAt: new Date() })
    .where(eq(integration.id, row.id));
  await log(row.id, env, "activeEnv", "env_switched", actorId);
  invalidateIntegrationCache(key);
}

/** Lista de campos requeridos que faltan para el ambiente indicado. */
export async function missingRequired(key: IntegrationKey, env: Env): Promise<string[]> {
  const def = getDefinition(key);
  const row = await getRow(key);
  const values = await loadConfigValues(row.id, env);
  const secrets = await systemDb()
    .select()
    .from(integrationSecret)
    .where(and(eq(integrationSecret.integrationId, row.id), eq(integrationSecret.env, env)));
  return def.fields
    .filter((f) => f.required)
    .filter((f) =>
      f.kind === "secret"
        ? !secrets.some((s) => s.name === f.name)
        : (values[f.name] ?? f.defaults?.[env]) === undefined,
    )
    .map((f) => f.label);
}

export async function setEnabled(key: IntegrationKey, enabled: boolean, actorId: string) {
  const row = await getRow(key);
  if (enabled) {
    const missing = await missingRequired(key, row.activeEnv);
    if (missing.length) throw new Error(`No se puede activar: falta ${missing.join(", ")}`);
  }
  await systemDb()
    .update(integration)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(integration.id, row.id));
  await log(row.id, null, "enabled", enabled ? "enabled" : "disabled", actorId);
  invalidateIntegrationCache(key);
}

async function loadRuntime(key: IntegrationKey, env: Env): Promise<Runtime> {
  const def = getDefinition(key);
  const row = await getRow(key);
  const values = await loadConfigValues(row.id, env);
  const config: Record<string, unknown> = {};
  for (const f of def.fields.filter((f) => f.kind === "config")) {
    const v = values[f.name] ?? f.defaults?.[env];
    if (v !== undefined) config[f.name] = v;
  }
  const rows = await systemDb()
    .select()
    .from(integrationSecret)
    .where(and(eq(integrationSecret.integrationId, row.id), eq(integrationSecret.env, env)));
  const secrets: Record<string, string> = {};
  for (const s of rows) secrets[s.name] = decrypt(s.encrypted, aad(key, env, s.name));
  return { env, enabled: row.enabled, config, secrets };
}

/** SOLO servidor: configuración + secretos descifrados del ambiente activo (con caché de 30 s). */
export async function getRuntimeConfig(key: IntegrationKey): Promise<Runtime> {
  const row = await getRow(key);
  const ck = `${key}:${row.activeEnv}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS && hit.value.enabled === row.enabled)
    return hit.value;
  const value = await loadRuntime(key, row.activeEnv);
  cache.set(ck, { at: Date.now(), value });
  return value;
}

/** Única configuración que puede viajar al navegador: campos marcados `clientSafe` (p. ej. llave pública de Wompi). */
export async function getClientSafeConfig(key: IntegrationKey) {
  const def = getDefinition(key);
  const rt = await getRuntimeConfig(key);
  const out: Record<string, unknown> = { env: rt.env };
  for (const f of def.fields.filter((f) => f.clientSafe)) out[f.name] = rt.config[f.name];
  return out;
}

export async function testConnection(
  key: IntegrationKey,
  env: Env,
  actorId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TestResult> {
  const def = getDefinition(key);
  const row = await getRow(key);
  const rt = await loadRuntime(key, env);
  let result: TestResult;
  try {
    result = await def.test({ env, config: rt.config, secrets: rt.secrets, fetch: fetchImpl });
  } catch (e) {
    result = { ok: false, message: e instanceof Error ? e.message : "Error desconocido" };
  }
  await systemDb()
    .update(integration)
    .set({
      lastTestAt: new Date(),
      lastTestOk: result.ok,
      lastTestMessage: result.message,
      consecutiveFailures: result.ok ? 0 : row.consecutiveFailures + 1,
    })
    .where(eq(integration.id, row.id));
  await log(row.id, env, "connection", result.ok ? "test_ok" : "test_failed", actorId);
  return result;
}

export type IntegrationAlert = {
  integration: IntegrationKey;
  kind: "secret_expiring" | "secret_expired" | "repeated_failures";
  detail: string;
};

/** Alertas para el cron diario: secretos próximos a vencer/vencidos y fallos repetidos. */
export async function integrationAlerts(
  opts: { expiringDays?: number; failureThreshold?: number; now?: Date } = {},
) {
  const now = opts.now ?? new Date();
  const limit = new Date(now.getTime() + (opts.expiringDays ?? 30) * 86_400_000);
  const alerts: IntegrationAlert[] = [];
  const rows = await systemDb().select().from(integration);
  const secrets = await systemDb().select().from(integrationSecret);
  for (const s of secrets) {
    if (!s.expiresAt) continue;
    const row = rows.find((r) => r.id === s.integrationId);
    if (!row || !(row.key in DEFINITIONS)) continue;
    if (s.expiresAt <= now)
      alerts.push({
        integration: row.key as IntegrationKey,
        kind: "secret_expired",
        detail: `${s.name} (${s.env}) venció`,
      });
    else if (s.expiresAt <= limit)
      alerts.push({
        integration: row.key as IntegrationKey,
        kind: "secret_expiring",
        detail: `${s.name} (${s.env}) vence el ${s.expiresAt.toISOString().slice(0, 10)}`,
      });
  }
  for (const r of rows) {
    if (r.consecutiveFailures >= (opts.failureThreshold ?? 3)) {
      alerts.push({
        integration: r.key as IntegrationKey,
        kind: "repeated_failures",
        detail: `${r.consecutiveFailures} fallos consecutivos`,
      });
    }
  }
  return alerts;
}
