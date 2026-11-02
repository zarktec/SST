SELECT enable_tenant_rls('perf_settings');
--> statement-breakpoint
SELECT enable_tenant_rls('perf_cycle');
--> statement-breakpoint
SELECT enable_tenant_rls('perf_subject');
--> statement-breakpoint
SELECT enable_tenant_rls('perf_assignment');
--> statement-breakpoint
SELECT enable_tenant_rls('perf_response');
--> statement-breakpoint
-- Los ciclos y las respuestas no se borran; las respuestas tampoco se modifican (solo se insertan al enviar).
REVOKE DELETE ON perf_cycle, perf_subject, perf_response FROM app_tenant;
--> statement-breakpoint
REVOKE UPDATE ON perf_response FROM app_tenant;
--> statement-breakpoint
-- El módulo de evaluación 360 queda incluido en todos los planes existentes (el SUPER ADMIN lo quita desde Planes).
UPDATE plan SET modules = array_append(modules, 'evaluacion_360') WHERE NOT ('evaluacion_360' = ANY(modules));
--> statement-breakpoint
-- Permisos del nuevo módulo "performance" para los roles de sistema ya existentes.
INSERT INTO role_permission (id, tenant_id, role_id, module, action, scope)
SELECT gen_random_uuid(), r.tenant_id, r.id, 'performance', a.action::permission_action, 'all'
FROM role r
CROSS JOIN (VALUES ('view'),('create'),('edit'),('delete'),('approve'),('export')) AS a(action)
WHERE r.system_key = 'ADMIN_EMPRESA'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO role_permission (id, tenant_id, role_id, module, action, scope)
SELECT gen_random_uuid(), r.tenant_id, r.id, 'performance', a.action::permission_action, 'all'
FROM role r
CROSS JOIN (VALUES ('view'),('create'),('edit'),('approve'),('export')) AS a(action)
WHERE r.system_key = 'ALTA_DIRECCION'
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO role_permission (id, tenant_id, role_id, module, action, scope)
SELECT gen_random_uuid(), r.tenant_id, r.id, 'performance', 'view'::permission_action, 'own'
FROM role r
WHERE r.system_key IN ('RESPONSABLE_SST','APOYO_SST','MIEMBRO_COPASST','MIEMBRO_CCL','JEFE_AREA','BRIGADISTA','TRABAJADOR','CONTRATISTA')
ON CONFLICT DO NOTHING;
