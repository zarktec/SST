SELECT enable_tenant_rls('data_consent');
--> statement-breakpoint
SELECT enable_tenant_rls('data_request');
--> statement-breakpoint
-- Registros ♻: no se borran físicamente.
REVOKE DELETE ON data_consent, data_request FROM app_tenant;
