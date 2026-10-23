SELECT enable_tenant_rls('training_course');
--> statement-breakpoint
SELECT enable_tenant_rls('training_question');
--> statement-breakpoint
SELECT enable_tenant_rls('training_session');
--> statement-breakpoint
SELECT enable_tenant_rls('training_attendance');
--> statement-breakpoint
SELECT enable_tenant_rls('position_requirement');
--> statement-breakpoint
-- Registros ♻ de capacitación: sin borrado físico (las preguntas y requisitos de cargo sí son configuración editable).
REVOKE DELETE ON training_course, training_session, training_attendance FROM app_tenant;
