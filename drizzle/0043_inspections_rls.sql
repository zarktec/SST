SELECT enable_tenant_rls('inspection_template');
--> statement-breakpoint
SELECT enable_tenant_rls('inspection');
--> statement-breakpoint
-- Registro ♻: las inspecciones realizadas no se borran físicamente.
REVOKE DELETE ON inspection FROM app_tenant;
