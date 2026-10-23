-- Roles de aplicación. La conexión usa el rol propietario y cambia de rol por transacción
-- (SET LOCAL ROLE) → una sola cadena de conexión sirve en Neon, local y CI.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    CREATE ROLE app_tenant NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_platform') THEN
    CREATE ROLE app_platform NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
GRANT app_tenant, app_platform TO CURRENT_USER;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_tenant, app_platform;
--> statement-breakpoint
-- La plataforma accede a todo lo que cree el propietario; el aislamiento por tenant lo dan las políticas RLS.
-- app_tenant NO recibe privilegios por defecto: cada tabla se concede explícitamente (default-deny).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_platform;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO app_platform;
--> statement-breakpoint
-- Contexto de la transacción actual (fijado por withTenant / withPlatform con SET LOCAL).
CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')::uuid
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_user_id() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')
$$;
--> statement-breakpoint
-- Solo es verdadero si el rol efectivo ES app_platform: un tenant no puede simularlo con un SET.
CREATE OR REPLACE FUNCTION app_is_platform() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT current_user = 'app_platform' AND coalesce(current_setting('app.is_platform', true), '') = 'true'
$$;
--> statement-breakpoint
-- Activa RLS forzada con la política estándar de aislamiento y concede acceso a los roles de la app.
CREATE OR REPLACE FUNCTION enable_tenant_rls(tbl regclass, col text DEFAULT 'tenant_id') RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', tbl);
  EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %s', tbl);
  EXECUTE format(
    'CREATE POLICY tenant_isolation ON %s USING (%I = app_tenant_id() OR app_is_platform()) WITH CHECK (%I = app_tenant_id() OR app_is_platform())',
    tbl, col, col
  );
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %s TO app_tenant, app_platform', tbl);
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION deny_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo inserción', TG_TABLE_NAME;
END
$$;
