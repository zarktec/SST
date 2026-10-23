SELECT enable_tenant_rls('ccl_complaint');
--> statement-breakpoint
SELECT enable_tenant_rls('ccl_complaint_event');
--> statement-breakpoint
SELECT enable_tenant_rls('harassment_report');
--> statement-breakpoint
REVOKE DELETE ON ccl_complaint, ccl_complaint_event, harassment_report FROM app_tenant;
--> statement-breakpoint
-- La trazabilidad del trámite no se puede reescribir.
REVOKE UPDATE ON ccl_complaint_event FROM app_tenant, app_platform;
