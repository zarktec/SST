-- Tablas con tenant_id: RLS forzada + política de aislamiento.
SELECT enable_tenant_rls('tenant', 'id');
--> statement-breakpoint
SELECT enable_tenant_rls('tenant_domain');
--> statement-breakpoint
SELECT enable_tenant_rls('tenant_branding');
--> statement-breakpoint
SELECT enable_tenant_rls('work_center');
--> statement-breakpoint
SELECT enable_tenant_rls('role');
--> statement-breakpoint
SELECT enable_tenant_rls('role_permission');
--> statement-breakpoint
SELECT enable_tenant_rls('membership');
--> statement-breakpoint
SELECT enable_tenant_rls('invitation');
--> statement-breakpoint
SELECT enable_tenant_rls('file');
--> statement-breakpoint
SELECT enable_tenant_rls('audit_log');
--> statement-breakpoint
SELECT enable_tenant_rls('sensitive_access_log');
--> statement-breakpoint
-- La empresa no crea ni borra empresas ni cambia su estado/plan/retención: solo edita su perfil.
REVOKE INSERT, UPDATE, DELETE ON tenant FROM app_tenant;
--> statement-breakpoint
GRANT UPDATE (legal_name, trade_name, nit, nit_dv, ciiu, risk_class, arl, legal_representative, sso_only, allowed_email_domains, sensitive_access_granted_until, updated_at)
  ON tenant TO app_tenant;
--> statement-breakpoint
-- Logs inmutables: solo INSERT/SELECT para los roles de la app y trigger que bloquea UPDATE/DELETE/TRUNCATE (incluso al propietario).
REVOKE UPDATE, DELETE, TRUNCATE ON audit_log, sensitive_access_log FROM app_tenant, app_platform;
--> statement-breakpoint
CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION deny_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON audit_log
  FOR EACH STATEMENT EXECUTE FUNCTION deny_mutation();
--> statement-breakpoint
CREATE TRIGGER sensitive_access_log_immutable BEFORE UPDATE OR DELETE ON sensitive_access_log
  FOR EACH ROW EXECUTE FUNCTION deny_mutation();
--> statement-breakpoint
CREATE TRIGGER sensitive_access_log_no_truncate BEFORE TRUNCATE ON sensitive_access_log
  FOR EACH STATEMENT EXECUTE FUNCTION deny_mutation();
--> statement-breakpoint
-- Usuarios: el contexto de empresa solo puede leer datos de perfil básicos (nunca contraseñas/tokens: están en "account").
GRANT SELECT (id, name, email, image) ON "user" TO app_tenant;
