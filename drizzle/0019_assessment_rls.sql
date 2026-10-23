SELECT enable_tenant_rls('self_assessment');
--> statement-breakpoint
SELECT enable_tenant_rls('self_assessment_item');
--> statement-breakpoint
SELECT enable_tenant_rls('improvement_item');
--> statement-breakpoint
-- Registros ♻: sin borrado físico por la empresa.
REVOKE DELETE ON self_assessment, self_assessment_item, improvement_item FROM app_tenant;
