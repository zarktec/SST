import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeDb, schema, systemDb } from "@/core/db";
import { hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import {
  clearSecret,
  getClientSafeConfig,
  getIntegrationView,
  getRuntimeConfig,
  integrationAlerts,
  saveConfig,
  setActiveEnv,
  setEnabled,
  setSecret,
  testConnection,
} from "./service";

pointToTestDb();
const ACTOR = "admin-1";

const wompiMerchant = (ok: boolean) =>
  (async () =>
    ok
      ? new Response(JSON.stringify({ data: { name: "Zark SAS", presigned_acceptance: {} } }), {
          status: 200,
        })
      : new Response("{}", { status: 404 })) as unknown as typeof fetch;

describe.skipIf(!hasTestDb)("centro de integraciones", () => {
  beforeAll(() => {
    process.env.ENCRYPTION_MASTER_KEY ??= Buffer.alloc(32, 7).toString("base64");
  });
  beforeEach(async () => {
    await systemDb().delete(schema.integration);
  });
  afterAll(closeDb);

  it("guarda secretos cifrados y la vista solo muestra la máscara", async () => {
    await setSecret("wompi", "sandbox", "privateKey", "prv_test_abcdef123456", { actorId: ACTOR });
    const raw = await systemDb().select().from(schema.integrationSecret);
    expect(JSON.stringify(raw)).not.toContain("abcdef123456");

    const view = await getIntegrationView("wompi", "sst.zark.pro");
    const field = view.envs.sandbox.find((f) => f.name === "privateKey")!;
    expect(field.mask).toBe("prv_test_••••••3456");
    expect(field.value).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain("abcdef123456");
  });

  it("el runtime descifra y la caché se invalida al guardar", async () => {
    await setSecret("wompi", "sandbox", "privateKey", "prv_test_first_0001", { actorId: ACTOR });
    expect((await getRuntimeConfig("wompi")).secrets.privateKey).toBe("prv_test_first_0001");
    await setSecret("wompi", "sandbox", "privateKey", "prv_test_second_0002", { actorId: ACTOR });
    expect((await getRuntimeConfig("wompi")).secrets.privateKey).toBe("prv_test_second_0002");
    await clearSecret("wompi", "sandbox", "privateKey", ACTOR);
    expect((await getRuntimeConfig("wompi")).secrets.privateKey).toBeUndefined();
  });

  it("el historial registra quién y qué, nunca el valor", async () => {
    await setSecret("wompi", "sandbox", "eventsSecret", "evt_super_secreto_9999", {
      actorId: ACTOR,
    });
    await saveConfig("wompi", "sandbox", { publicKey: "pub_test_123" }, ACTOR);
    const logs = await systemDb().select().from(schema.integrationChangeLog);
    expect(logs.map((l) => l.action).sort()).toEqual(["config_updated", "secret_replaced"]);
    expect(logs.every((l) => l.actorId === ACTOR)).toBe(true);
    expect(JSON.stringify(logs)).not.toContain("super_secreto");
    expect(JSON.stringify(logs)).not.toContain("pub_test_123");
  });

  it("rechaza campos inexistentes y valores inválidos", async () => {
    await expect(
      setSecret("wompi", "sandbox", "publicKey", "xxxxxxxx", { actorId: ACTOR }),
    ).rejects.toThrow();
    await expect(
      saveConfig("wompi", "sandbox", { apiBaseUrl: "no-es-url" }, ACTOR),
    ).rejects.toThrow();
  });

  it("no permite activar una integración incompleta", async () => {
    await expect(setEnabled("wompi", true, ACTOR)).rejects.toThrow(/falta/i);
    await saveConfig("wompi", "sandbox", { publicKey: "pub_test_1" }, ACTOR);
    for (const n of ["privateKey", "eventsSecret", "integritySecret"]) {
      await setSecret("wompi", "sandbox", n, `${n}_valor_1234`, { actorId: ACTOR });
    }
    await setEnabled("wompi", true, ACTOR);
    expect((await getRuntimeConfig("wompi")).enabled).toBe(true);
  });

  it("separa ambientes: sandbox y producción tienen valores independientes", async () => {
    await saveConfig("wompi", "sandbox", { publicKey: "pub_test_sb" }, ACTOR);
    await saveConfig("wompi", "production", { publicKey: "pub_prod_pr" }, ACTOR);
    expect((await getRuntimeConfig("wompi")).config.publicKey).toBe("pub_test_sb");
    await setActiveEnv("wompi", "production", ACTOR);
    const rt = await getRuntimeConfig("wompi");
    expect(rt.env).toBe("production");
    expect(rt.config.publicKey).toBe("pub_prod_pr");
    expect(rt.config.apiBaseUrl).toBe("https://production.wompi.co/v1");
  });

  it("al navegador solo viaja la llave pública", async () => {
    await saveConfig("wompi", "sandbox", { publicKey: "pub_test_1" }, ACTOR);
    await setSecret("wompi", "sandbox", "privateKey", "prv_test_nunca_1234", { actorId: ACTOR });
    const safe = await getClientSafeConfig("wompi");
    expect(safe).toEqual({ env: "sandbox", publicKey: "pub_test_1" });
  });

  it("probar conexión guarda el resultado y cuenta fallos consecutivos", async () => {
    await saveConfig("wompi", "sandbox", { publicKey: "pub_test_1" }, ACTOR);
    const bad = await testConnection("wompi", "sandbox", ACTOR, wompiMerchant(false));
    expect(bad.ok).toBe(false);
    await testConnection("wompi", "sandbox", ACTOR, wompiMerchant(false));
    let view = await getIntegrationView("wompi", "sst.zark.pro");
    expect(view.consecutiveFailures).toBe(2);
    expect(view.lastTestOk).toBe(false);

    const good = await testConnection("wompi", "sandbox", ACTOR, wompiMerchant(true));
    expect(good).toEqual({ ok: true, message: 'Conexión correcta con el comercio "Zark SAS".' });
    view = await getIntegrationView("wompi", "sst.zark.pro");
    expect(view.consecutiveFailures).toBe(0);
  });

  it("Siigo envía Partner-Id y credenciales a /auth", async () => {
    await saveConfig("siigo", "sandbox", { username: "api@zark.pro", partnerId: "zarkSST" }, ACTOR);
    await setSecret("siigo", "sandbox", "accessKey", "key_siigo_abcd1234", { actorId: ACTOR });
    let seen: { url: string; headers: Record<string, string>; body: string } | undefined;
    const f = (async (url: string, init: RequestInit) => {
      seen = { url, headers: init.headers as Record<string, string>, body: String(init.body) };
      return new Response(JSON.stringify({ access_token: "t" }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await testConnection("siigo", "sandbox", ACTOR, f);
    expect(r.ok).toBe(true);
    expect(seen?.url).toBe("https://api.siigo.com/auth");
    expect(seen?.headers["Partner-Id"]).toBe("zarkSST");
    expect(JSON.parse(seen!.body)).toEqual({
      username: "api@zark.pro",
      access_key: "key_siigo_abcd1234",
    });
  });

  it("AUCO: usa la llave pública (puk_) en GET /company del ambiente stage", async () => {
    await saveConfig("auco", "sandbox", { publicKey: "puk_test_ABC123" }, ACTOR);
    let seen: { url: string; auth: string } | undefined;
    const f = (async (url: string, init: RequestInit) => {
      seen = { url, auth: (init.headers as Record<string, string>).Authorization };
      return new Response(JSON.stringify({ name: "Zark" }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await testConnection("auco", "sandbox", ACTOR, f)).toEqual({
      ok: true,
      message: 'Conexión correcta con la organización "Zark".',
    });
    expect(seen).toEqual({ url: "https://dev.auco.ai/v1.5/ext/company", auth: "puk_test_ABC123" });
    const unauthorized = (async () =>
      new Response("{}", { status: 401 })) as unknown as typeof fetch;
    expect((await testConnection("auco", "sandbox", ACTOR, unauthorized)).message).toMatch(/401/);
    await saveConfig("auco", "sandbox", { publicKey: "abc" }, ACTOR);
    expect((await testConnection("auco", "sandbox", ACTOR, f)).message).toMatch(/puk_/);
    const safe = await getClientSafeConfig("auco");
    expect(Object.keys(safe).sort()).toEqual(["env", "publicKey"]);
  });

  it("alerta de secretos de Microsoft próximos a vencer, vencidos y de fallos repetidos", async () => {
    const now = new Date("2026-10-01T00:00:00Z");
    await setSecret("microsoft", "production", "clientSecret", "ms_secret_valor_0001", {
      actorId: ACTOR,
      expiresAt: new Date("2026-10-20T00:00:00Z"),
    });
    let alerts = await integrationAlerts({ now, expiringDays: 30 });
    expect(alerts).toEqual([
      {
        integration: "microsoft",
        kind: "secret_expiring",
        detail: "clientSecret (production) vence el 2026-10-20",
      },
    ]);
    alerts = await integrationAlerts({ now: new Date("2026-11-01T00:00:00Z") });
    expect(alerts[0].kind).toBe("secret_expired");

    await systemDb()
      .update(schema.integration)
      .set({ consecutiveFailures: 3 })
      .where(eq(schema.integration.key, "wompi"));
    alerts = await integrationAlerts({ now });
    expect(alerts.some((a) => a.integration === "wompi" && a.kind === "repeated_failures")).toBe(
      true,
    );
  });

  it("el secreto de un campo no expira si el campo no admite vencimiento", async () => {
    await setSecret("wompi", "sandbox", "privateKey", "prv_test_abcd_1234", {
      actorId: ACTOR,
      expiresAt: new Date("2026-10-20T00:00:00Z"),
    });
    const [s] = await systemDb().select().from(schema.integrationSecret);
    expect(s.expiresAt).toBeNull();
  });
});
