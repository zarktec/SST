SELECT enable_tenant_rls('unsafe_report');
--> statement-breakpoint
-- Registro ♻: los reportes no se borran físicamente.
REVOKE DELETE ON unsafe_report FROM app_tenant;
