-- Facturas: la empresa las LEE (portal de facturación) y la plataforma las escribe.
SELECT enable_tenant_rls('invoice');
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON invoice FROM app_tenant;
--> statement-breakpoint
-- Datos de facturación: la empresa los edita directamente (RLS garantiza que solo toca su fila).
SELECT enable_tenant_rls('billing_profile');
--> statement-breakpoint
REVOKE DELETE ON billing_profile FROM app_tenant;
