SELECT enable_tenant_rls('audit');
--> statement-breakpoint
SELECT enable_tenant_rls('management_review');
--> statement-breakpoint
-- Registros ♻: no se borran físicamente.
REVOKE DELETE ON audit, management_review FROM app_tenant;
