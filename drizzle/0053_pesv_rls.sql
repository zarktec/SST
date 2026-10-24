SELECT enable_tenant_rls('pesv_vehicle');
--> statement-breakpoint
SELECT enable_tenant_rls('pesv_driver');
--> statement-breakpoint
SELECT enable_tenant_rls('pesv_preop');
--> statement-breakpoint
SELECT enable_tenant_rls('pesv_crash');
--> statement-breakpoint
-- Registros ♻: no se borran físicamente.
REVOKE DELETE ON pesv_preop, pesv_crash FROM app_tenant;
