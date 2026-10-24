SELECT enable_tenant_rls('permit_type');
--> statement-breakpoint
SELECT enable_tenant_rls('height_certificate');
--> statement-breakpoint
SELECT enable_tenant_rls('height_equipment');
--> statement-breakpoint
SELECT enable_tenant_rls('work_permit');
--> statement-breakpoint
-- Registros ♻: no se borran físicamente.
REVOKE DELETE ON work_permit, height_certificate FROM app_tenant;
