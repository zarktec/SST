SELECT enable_tenant_rls('corrective_action');
--> statement-breakpoint
REVOKE DELETE ON corrective_action FROM app_tenant;
