SELECT enable_tenant_rls('legal_matrix_entry');
--> statement-breakpoint
REVOKE DELETE ON legal_matrix_entry FROM app_tenant;
