"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformStaff } from "@/core/auth/session";
import { withPlatform } from "@/core/db";
import {
  clearSecret,
  saveConfig,
  setActiveEnv,
  setEnabled,
  setSecret,
  testConnection,
} from "@/integrations/registry/service";
import { INTEGRATION_KEYS, type Env } from "@/integrations/registry/types";

export type ActionResult = { ok: boolean; message: string };

const keySchema = z.enum(INTEGRATION_KEYS);
const envSchema = z.enum(["sandbox", "production"]);

/** Solo SUPER_ADMIN (con 2FA). Cada acción queda en audit_log (sin valores) además del historial de la integración. */
async function guard(action: string, detail: Record<string, string>) {
  const staff = await requirePlatformStaff({ allow: ["SUPER_ADMIN"] });
  await withPlatform(
    { actorId: staff.user.id, action: `integration.${action}`, reason: JSON.stringify(detail) },
    async () => undefined,
  );
  return staff.user.id;
}

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    return { ok: true, message: await fn() };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Error inesperado" };
  }
}

export async function saveConfigAction(
  key: string,
  env: string,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const k = keySchema.parse(key);
  const e = envSchema.parse(env);
  const actor = await guard("save_config", { key: k, env: e });
  return run(async () => {
    const values: Record<string, unknown> = {};
    for (const [name, value] of form.entries())
      if (typeof value === "string" && !name.startsWith("$")) values[name] = value;
    // Los checkbox desmarcados no se envían: se normalizan a false cuando el campo existe en el formulario.
    for (const name of String(form.get("$booleans") ?? "")
      .split(",")
      .filter(Boolean))
      values[name] = form.get(name) === "on";
    const changed = await saveConfig(k, e, values, actor);
    revalidatePath(`/integrations/${k}`);
    return changed.length
      ? `Guardado (${changed.length} cambio${changed.length > 1 ? "s" : ""}).`
      : "Sin cambios.";
  });
}

export async function replaceSecretAction(
  key: string,
  env: string,
  name: string,
  _prev: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const k = keySchema.parse(key);
  const e = envSchema.parse(env);
  const actor = await guard("replace_secret", { key: k, env: e, field: name });
  return run(async () => {
    const value = String(form.get("value") ?? "");
    const exp = String(form.get("expiresAt") ?? "");
    const mask = await setSecret(k, e, name, value, {
      actorId: actor,
      expiresAt: exp ? new Date(`${exp}T23:59:59-05:00`) : null,
    });
    revalidatePath(`/integrations/${k}`);
    return `Secreto guardado: ${mask}`;
  });
}

export async function clearSecretAction(key: string, env: string, name: string): Promise<void> {
  const k = keySchema.parse(key);
  const e = envSchema.parse(env);
  const actor = await guard("remove_secret", { key: k, env: e, field: name });
  await clearSecret(k, e, name, actor);
  revalidatePath(`/integrations/${k}`);
}

export async function testConnectionAction(key: string, env: string): Promise<ActionResult> {
  const k = keySchema.parse(key);
  const e = envSchema.parse(env);
  const actor = await guard("test_connection", { key: k, env: e });
  const r = await testConnection(k, e as Env, actor);
  revalidatePath(`/integrations/${k}`);
  return r;
}

export async function setActiveEnvAction(key: string, env: string): Promise<void> {
  const k = keySchema.parse(key);
  const e = envSchema.parse(env);
  const actor = await guard("switch_env", { key: k, env: e });
  await setActiveEnv(k, e, actor);
  revalidatePath("/integrations", "layout");
}

export async function toggleEnabledAction(key: string, enabled: boolean): Promise<ActionResult> {
  const k = keySchema.parse(key);
  const actor = await guard(enabled ? "enable" : "disable", { key: k });
  return run(async () => {
    await setEnabled(k, enabled, actor);
    revalidatePath("/integrations", "layout");
    return enabled ? "Integración activada." : "Integración desactivada.";
  });
}
