SELECT enable_tenant_rls('emergency_plan');
--> statement-breakpoint
SELECT enable_tenant_rls('brigade_member');
--> statement-breakpoint
SELECT enable_tenant_rls('emergency_asset');
--> statement-breakpoint
SELECT enable_tenant_rls('emergency_asset_inspection');
--> statement-breakpoint
SELECT enable_tenant_rls('drill');
--> statement-breakpoint
-- Registros ♻: no se borran físicamente.
REVOKE DELETE ON emergency_plan, brigade_member, emergency_asset, emergency_asset_inspection, drill FROM app_tenant;
