import { expect, type Page } from "@playwright/test";
import { generateSync } from "otplib";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });

export const TENANT = "http://demo.localhost:3000";
export const ADMIN = "http://admin.localhost:3000";
export const ADMIN_EMAIL = "admin@zark.pro";
export const ADMIN_PASSWORD = "SuperClave-2026!";

export async function clearRateLimit() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query("DELETE FROM rate_limit");
  await pool.end();
}

/** Estado limpio entre pruebas: sin límites de tasa y SUPER ADMIN sin 2FA ni integraciones configuradas. */
export async function resetState() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query("DELETE FROM rate_limit");
  await pool.query("DELETE FROM two_factor");
  await pool.query('UPDATE "user" SET two_factor_enabled = false WHERE email = $1', [ADMIN_EMAIL]);
  await pool.query(
    'DELETE FROM session WHERE user_id IN (SELECT id FROM "user" WHERE email = $1)',
    [ADMIN_EMAIL],
  );
  await pool.query("DELETE FROM integration");
  // Onboarding de la empresa demo: vuelve a empezar en cada prueba.
  const demo = "(SELECT id FROM tenant WHERE slug = 'demo')";
  for (const t of [
    "ppe_delivery",
    "ppe_stock_entry",
    "ppe_requirement",
    "ppe_item",
    "training_attendance",
    "training_session",
    "training_question",
    "position_requirement",
    "training_course",
    "annual_activity",
    "annual_plan",
    "legal_matrix_entry",
    "improvement_item",
    "self_assessment_item",
    "self_assessment",
    "contractor_ss_check",
    "worker",
    "work_center",
    "sst_responsible",
    "tenant_alert",
  ])
    await pool.query(`DELETE FROM ${t} WHERE tenant_id IN ${demo}`);
  // El administrador demo gestiona personas en las pruebas (por defecto ADMIN_EMPRESA solo las ve).
  await pool.query(
    `INSERT INTO role_permission (id, tenant_id, role_id, module, action, scope)
     SELECT gen_random_uuid(), r.tenant_id, r.id, 'workers', a.action::permission_action, 'all'
     FROM role r CROSS JOIN (VALUES ('create'),('edit')) AS a(action)
     WHERE r.system_key = 'ADMIN_EMPRESA' AND r.tenant_id IN ${demo}
     ON CONFLICT DO NOTHING`,
  );
  await pool.query(
    `INSERT INTO role_permission (id, tenant_id, role_id, module, action, scope)
     SELECT gen_random_uuid(), r.tenant_id, r.id, m.module, a.action::permission_action, 'all'
     FROM role r CROSS JOIN (VALUES ('create'),('edit'),('approve')) AS a(action)
     CROSS JOIN (VALUES ('standards'),('legal_matrix'),('hazard_matrix'),('annual_plan'),('training'),('ppe'),('committees'),('medical')) AS m(module)
     WHERE r.system_key = 'ADMIN_EMPRESA' AND r.tenant_id IN ${demo}
     ON CONFLICT DO NOTHING`,
  );
  await pool.query(
    "UPDATE tenant SET workers_count = NULL, standards_group = NULL, onboarding_completed_at = NULL, risk_class = NULL WHERE slug = 'demo'",
  );
  // Empresas creadas por las pruebas E2E (los logs de solo-inserción exigen desactivar triggers: BD local de pruebas).
  const client = await pool.connect();
  try {
    await client.query("SET session_replication_role = replica");
    for (const t of ["hazard_row", "hazard_matrix"])
      await client.query(
        `DELETE FROM ${t} WHERE tenant_id IN (SELECT id FROM tenant WHERE slug = 'demo')`,
      );
    const sub = "(SELECT id FROM tenant WHERE slug LIKE 'e2e-%')";
    for (const t of [
      "subscription_event",
      "subscription",
      "audit_log",
      "tenant_domain",
      "tenant_branding",
      "invitation",
      "membership",
      "role_permission",
      "role",
      "work_center",
    ]) {
      await client.query(`DELETE FROM ${t} WHERE tenant_id IN ${sub}`);
    }
    await client.query("DELETE FROM tenant WHERE slug LIKE 'e2e-%'");
    // Catálogo vacío usado por las pruebas E2E (las versiones publicadas son inmutables: se borra con triggers desactivados).
    await client.query(
      "DELETE FROM catalog_item WHERE version_id IN (SELECT id FROM catalog_version WHERE catalog = 'hazard_catalog')",
    );
    await client.query("DELETE FROM catalog_version WHERE catalog = 'hazard_catalog'");
    await client.query(
      "DELETE FROM catalog_item WHERE version_id IN (SELECT id FROM catalog_version WHERE catalog = 'standards_0312')",
    );
    await client.query("DELETE FROM catalog_version WHERE catalog = 'standards_0312'");
  } finally {
    client.release();
  }
  await pool.query(
    "DELETE FROM plan_price WHERE plan_id IN (SELECT id FROM plan WHERE key LIKE 'e2e-%')",
  );
  await pool.query("DELETE FROM plan WHERE key LIKE 'e2e-%'");
  await pool.query("DELETE FROM coupon WHERE code LIKE 'E2E%'");
  await pool.end();
}

/** Inicia sesión como SUPER ADMIN y activa 2FA por la UI (genera el código TOTP con el secreto del QR). */
export async function loginAdminWith2fa(page: Page) {
  await page.goto(`${ADMIN}/login`);
  await page.waitForLoadState("networkidle"); // los formularios son controlados: rellenar antes de hidratar pierde el valor
  await page.getByLabel("Correo electrónico").fill(ADMIN_EMAIL);
  await page.getByLabel("Contraseña").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/security\/2fa/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Confirma tu contraseña").fill(ADMIN_PASSWORD);
  await clearRateLimit(); // /two-factor/* admite 3 llamadas por 10 s: evita falsos 429 entre pruebas seguidas
  const enable = page.waitForResponse((r) => r.url().includes("/two-factor/enable"));
  await page.getByRole("button", { name: "Generar código QR" }).click();
  const resp = await enable;
  const body = (await resp.json()) as { totpURI?: string };
  if (!body.totpURI) throw new Error(`2FA enable falló: ${resp.status()} ${JSON.stringify(body)}`);
  const { totpURI } = body;
  const secret = new URL(totpURI).searchParams.get("secret")!;
  await page.getByLabel("Código de 6 dígitos").fill(generateSync({ secret }));
  await page.getByRole("button", { name: "Activar" }).click();
  await expect(page.getByText("2FA activado")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Panel de plataforma" })).toBeVisible();
  return secret;
}

/** Catálogo mínimo de estándares (solo pruebas E2E): publicado por SQL porque la carga real es un CSV del SUPER ADMIN. */
export async function seedStandardsCatalog() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("SET session_replication_role = replica");
    const { rows } = await client.query(
      `INSERT INTO catalog_version (catalog, version, status, effective_from, source_norm, published_at)
       VALUES ('standards_0312', 1, 'published', '2019-01-01', 'Resolución 0312 de 2019 (E2E)', now()) RETURNING id`,
    );
    const items = [
      ["1.1.1", 4],
      ["1.1.2", 6],
    ];
    for (const [i, [code, weight]] of items.entries())
      await client.query(
        "INSERT INTO catalog_item (version_id, code, data, sort_order) VALUES ($1, $2, $3, $4)",
        [
          rows[0].id,
          code,
          JSON.stringify({
            phva: "P",
            standardCode: "1",
            standardName: "Recursos",
            itemCode: code,
            criterion: `Criterio ${code}`,
            verification: "Documento",
            weight,
            appliesToGroups: [7, 21, 60],
            sourceNorm: "Res. 0312 (E2E)",
          }),
          i,
        ],
      );
  } finally {
    client.release();
    await pool.end();
  }
}
