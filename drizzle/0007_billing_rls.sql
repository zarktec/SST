-- La suscripción y su historial pertenecen a la empresa pero SOLO la plataforma los escribe.
SELECT enable_tenant_rls('subscription');
--> statement-breakpoint
SELECT enable_tenant_rls('subscription_event');
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON subscription FROM app_tenant;
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON subscription_event FROM app_tenant, app_platform;
--> statement-breakpoint
GRANT INSERT ON subscription_event TO app_platform;
--> statement-breakpoint
CREATE TRIGGER subscription_event_immutable BEFORE UPDATE OR DELETE ON subscription_event
  FOR EACH ROW EXECUTE FUNCTION deny_mutation();
--> statement-breakpoint
CREATE TRIGGER subscription_event_no_truncate BEFORE TRUNCATE ON subscription_event
  FOR EACH STATEMENT EXECUTE FUNCTION deny_mutation();
