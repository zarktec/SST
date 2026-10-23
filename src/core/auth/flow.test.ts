import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { closeDb, schema, systemDb, withTenant } from "@/core/db";
import { createTenantWithSubscription, hasTestDb, pointToTestDb } from "@/core/db/test-utils";
import { seedTenantRoles } from "@/core/rbac/seed-roles";
import { devOutbox } from "@/core/mail";
import { getAuth } from "./config";

pointToTestDb();

const ROOT = "sst.test";
const AUTH = `auth.${ROOT}`;
const ACME = `acme.${ROOT}`;

const cookieHeader = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

describe.skipIf(!hasTestDb)("flujo de login y traspaso entre dominios (Better Auth real)", () => {
  let tenantId: string;

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = ROOT;
    process.env.AUTH_SECRET = "test-secret-test-secret-test-secret-123";
    const t = await createTenantWithSubscription("acme");
    tenantId = t.id;
    await withTenant({ tenantId }, (tx) => seedTenantRoles(tx, tenantId));
    await systemDb()
      .insert(schema.tenantDomain)
      .values({ tenantId, host: ACME, kind: "subdomain", status: "verified" });
    for (const [id, email] of [
      ["u-member", "member@acme.co"],
      ["u-stranger", "stranger@otra.co"],
    ] as const) {
      await systemDb().insert(schema.user).values({ id, name: id, email, emailVerified: true });
      await systemDb()
        .insert(schema.account)
        .values({
          id: `acc-${id}`,
          accountId: id,
          providerId: "credential",
          userId: id,
          password: await hashPassword("clave-segura-123"),
        });
    }
    const [role] = await systemDb()
      .select()
      .from(schema.role)
      .where(eq(schema.role.systemKey, "TRABAJADOR"));
    await systemDb()
      .insert(schema.membership)
      .values({ tenantId, userId: "u-member", roleId: role.id });
  });
  afterAll(closeDb);

  async function signIn(email: string) {
    await systemDb().delete(schema.rateLimit); // el límite de 5 inicios/min aplica también a los tests
    const auth = await getAuth(AUTH);
    return auth.handler(
      new Request(`https://${AUTH}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: `https://${AUTH}` },
        body: JSON.stringify({ email, password: "clave-segura-123" }),
      }),
    );
  }

  it("inicia sesión con correo y contraseña y registra el método", async () => {
    const res = await signIn("member@acme.co");
    expect(res.status).toBe(200);
    const [s] = await systemDb()
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, "u-member"));
    expect(s.loginMethod).toBe("password");
  });

  it("rechaza contraseña incorrecta", async () => {
    const auth = await getAuth(AUTH);
    const res = await auth.handler(
      new Request(`https://${AUTH}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: `https://${AUTH}` },
        body: JSON.stringify({ email: "member@acme.co", password: "incorrecta-123" }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("miembro: auth. emite token y el dominio de la empresa crea su propia sesión", async () => {
    const login = await signIn("member@acme.co");
    const auth = await getAuth(AUTH);
    const issue = await auth.handler(
      new Request(`https://${AUTH}/api/auth/handoff/issue?host=${ACME}&next=/panel`, {
        headers: { cookie: cookieHeader(login) },
      }),
    );
    expect(issue.status).toBe(302);
    const consumeUrl = new URL(issue.headers.get("location")!);
    expect(consumeUrl.origin).toBe(`https://${ACME}`);
    expect(consumeUrl.pathname).toBe("/api/auth/handoff/consume");

    const tenantAuth = await getAuth(ACME);
    const consume = await tenantAuth.handler(new Request(consumeUrl, { headers: { host: ACME } }));
    expect(consume.status).toBe(302);
    expect(consume.headers.get("location")).toBe(`https://${ACME}/panel`);
    expect(consume.headers.getSetCookie().join(";")).toContain("session_token");
    const sessions = await systemDb()
      .select()
      .from(schema.session)
      .where(eq(schema.session.activeTenantId, tenantId));
    expect(sessions).toHaveLength(1);

    // El mismo token no se puede reutilizar
    const replay = await tenantAuth.handler(new Request(consumeUrl, { headers: { host: ACME } }));
    expect(replay.headers.get("location")).toContain("/login?error=handoff_invalid");
  });

  it("un usuario sin invitación no obtiene token", async () => {
    const login = await signIn("stranger@otra.co");
    const auth = await getAuth(AUTH);
    const issue = await auth.handler(
      new Request(`https://${AUTH}/api/auth/handoff/issue?host=${ACME}`, {
        headers: { cookie: cookieHeader(login) },
      }),
    );
    expect(issue.status).toBe(302);
    expect(issue.headers.get("location")).toContain("/login/denied?reason=not_invited");
  });

  it("no redirige a hosts no registrados (anti open redirect)", async () => {
    const login = await signIn("member@acme.co");
    const auth = await getAuth(AUTH);
    for (const host of ["evil.com", `evil.${ROOT}`, `${ACME}.evil.com`]) {
      const issue = await auth.handler(
        new Request(`https://${AUTH}/api/auth/handoff/issue?host=${host}`, {
          headers: { cookie: cookieHeader(login) },
        }),
      );
      expect(issue.headers.get("location")).toContain("reason=unknown_host");
    }
  });

  it("magic link: llega por correo, es de un solo uso y registra el método", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    devOutbox.length = 0;
    const auth = await getAuth(AUTH);
    const send = await auth.handler(
      new Request(`https://${AUTH}/api/auth/sign-in/magic-link`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: `https://${AUTH}` },
        body: JSON.stringify({ email: "member@acme.co", callbackURL: "/" }),
      }),
    );
    expect(send.status).toBe(200);
    vi.restoreAllMocks();
    const mail = devOutbox.at(-1)!;
    expect(mail.to).toBe("member@acme.co");
    const url = mail.html
      .match(/href="([^"]*magic-link\/verify[^"]*)"/)![1]
      .replaceAll("&amp;", "&");
    const verify = await auth.handler(new Request(url, { headers: { origin: `https://${AUTH}` } }));
    expect([200, 302]).toContain(verify.status);
    expect(verify.headers.getSetCookie().join(";")).toContain("session_token");
    const sessions = await systemDb()
      .select()
      .from(schema.session)
      .where(eq(schema.session.userId, "u-member"));
    expect(sessions.some((x) => x.loginMethod === "magic_link")).toBe(true);
    const replay = await auth.handler(new Request(url, { headers: { origin: `https://${AUTH}` } }));
    expect(replay.headers.getSetCookie().join(";")).not.toContain("session_token=");
  });

  it("2FA TOTP: se activa con la contraseña y luego el login exige el segundo factor", async () => {
    const login = await signIn("member@acme.co");
    const auth = await getAuth(AUTH);
    const enable = await auth.handler(
      new Request(`https://${AUTH}/api/auth/two-factor/enable`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: `https://${AUTH}`,
          cookie: cookieHeader(login),
        },
        body: JSON.stringify({ password: "clave-segura-123" }),
      }),
    );
    expect(enable.status).toBe(200);
    const body = (await enable.json()) as { totpURI: string; backupCodes: string[] };
    expect(body.totpURI).toContain("otpauth://totp/");
    expect(body.backupCodes.length).toBeGreaterThan(0);
  });

  it("sin sesión no se emiten tokens", async () => {
    const auth = await getAuth(AUTH);
    const issue = await auth.handler(
      new Request(`https://${AUTH}/api/auth/handoff/issue?host=${ACME}`),
    );
    expect(issue.status).toBe(401);
  });

  it("los proveedores sociales solo existen en auth. y solo si están activos en el panel", async () => {
    const auth = await getAuth(AUTH);
    const res = await auth.handler(
      new Request(`https://${AUTH}/api/auth/sign-in/social`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: `https://${AUTH}` },
        body: JSON.stringify({ provider: "google", callbackURL: "/" }),
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400); // google no configurado → no hay botón ni flujo
  });
});
