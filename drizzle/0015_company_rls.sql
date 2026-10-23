SELECT enable_tenant_rls('sst_responsible');
--> statement-breakpoint
SELECT enable_tenant_rls('tenant_alert');
--> statement-breakpoint
REVOKE DELETE ON sst_responsible, tenant_alert FROM app_tenant;
--> statement-breakpoint
GRANT UPDATE (workers_count, standards_group, onboarding_completed_at) ON tenant TO app_tenant;
--> statement-breakpoint
-- Permisos del nuevo módulo "company" para los roles de sistema ya existentes.
INSERT INTO role_permission (id, tenant_id, role_id, module, action, scope)
SELECT gen_random_uuid(), r.tenant_id, r.id, 'company', a.action::permission_action, 'all'
FROM role r
CROSS JOIN (VALUES ('view'),('create'),('edit'),('delete'),('approve'),('export')) AS a(action)
WHERE r.system_key = 'ADMIN_EMPRESA'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO role_permission (id, tenant_id, role_id, module, action, scope)
SELECT gen_random_uuid(), r.tenant_id, r.id, 'company', a.action::permission_action, 'all'
FROM role r
CROSS JOIN (VALUES ('view'),('edit')) AS a(action)
WHERE r.system_key = 'RESPONSABLE_SST'
ON CONFLICT DO NOTHING;
