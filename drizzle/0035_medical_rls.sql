SELECT enable_tenant_rls('medical_evaluation');
--> statement-breakpoint
SELECT enable_tenant_rls('job_adaptation_task');
--> statement-breakpoint
SELECT enable_tenant_rls('absence');
--> statement-breakpoint
-- Registros ♻ (20 años desde el retiro): sin borrado físico.
REVOKE DELETE ON medical_evaluation, job_adaptation_task, absence FROM app_tenant;
