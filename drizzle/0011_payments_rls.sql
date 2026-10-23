-- Métodos de pago y cobros pertenecen a la empresa (la empresa los LEE) pero solo la plataforma los escribe.
SELECT enable_tenant_rls('payment_source');
--> statement-breakpoint
SELECT enable_tenant_rls('payment');
--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON payment_source, payment FROM app_tenant;
