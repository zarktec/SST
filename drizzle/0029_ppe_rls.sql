SELECT enable_tenant_rls('ppe_item');
--> statement-breakpoint
SELECT enable_tenant_rls('ppe_requirement');
--> statement-breakpoint
SELECT enable_tenant_rls('ppe_stock_entry');
--> statement-breakpoint
SELECT enable_tenant_rls('ppe_delivery');
--> statement-breakpoint
-- Entregas e ingresos de inventario son registros ♻: sin borrado físico.
REVOKE DELETE ON ppe_item, ppe_stock_entry, ppe_delivery FROM app_tenant;
