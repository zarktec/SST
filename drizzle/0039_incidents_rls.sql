SELECT enable_tenant_rls('incident');
--> statement-breakpoint
SELECT enable_tenant_rls('incident_investigation');
--> statement-breakpoint
SELECT enable_tenant_rls('occupational_disease');
--> statement-breakpoint
-- Registros ♻: accidentes, investigaciones y enfermedades laborales no se borran físicamente.
REVOKE DELETE ON incident, incident_investigation, occupational_disease FROM app_tenant;
