SELECT enable_tenant_rls('pve_program');
--> statement-breakpoint
SELECT enable_tenant_rls('pve_activity');
--> statement-breakpoint
SELECT enable_tenant_rls('pve_case');
--> statement-breakpoint
SELECT enable_tenant_rls('pve_followup');
--> statement-breakpoint
SELECT enable_tenant_rls('psychosocial_assessment');
--> statement-breakpoint
-- Registros ♻: no se borran físicamente.
REVOKE DELETE ON pve_case, pve_followup, psychosocial_assessment FROM app_tenant;
