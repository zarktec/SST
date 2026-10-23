SELECT enable_tenant_rls('worker');
--> statement-breakpoint
SELECT enable_tenant_rls('contractor_ss_check');
--> statement-breakpoint
-- Registros ♻ (conservación mínima de 20 años): la empresa no puede borrar físicamente.
REVOKE DELETE ON worker, contractor_ss_check FROM app_tenant;
