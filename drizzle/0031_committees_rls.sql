SELECT enable_tenant_rls('committee');
--> statement-breakpoint
SELECT enable_tenant_rls('committee_member');
--> statement-breakpoint
SELECT enable_tenant_rls('committee_minutes');
--> statement-breakpoint
SELECT enable_tenant_rls('committee_commitment');
--> statement-breakpoint
SELECT enable_tenant_rls('election');
--> statement-breakpoint
SELECT enable_tenant_rls('election_candidate');
--> statement-breakpoint
SELECT enable_tenant_rls('election_voter');
--> statement-breakpoint
SELECT enable_tenant_rls('election_ballot');
--> statement-breakpoint
-- Registros ♻: comités, actas, compromisos y elecciones no se borran físicamente.
REVOKE DELETE ON committee, committee_member, committee_minutes, committee_commitment, election, election_candidate, election_voter, election_ballot FROM app_tenant;
--> statement-breakpoint
-- Voto secreto: las papeletas son de solo inserción (nadie las edita después de depositadas).
REVOKE UPDATE ON election_ballot FROM app_tenant, app_platform;
