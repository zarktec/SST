SELECT enable_tenant_rls('annual_plan');
--> statement-breakpoint
SELECT enable_tenant_rls('annual_activity');
--> statement-breakpoint
REVOKE DELETE ON annual_plan FROM app_tenant;
