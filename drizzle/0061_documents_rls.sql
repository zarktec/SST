SELECT enable_tenant_rls('document');
--> statement-breakpoint
SELECT enable_tenant_rls('document_version');
--> statement-breakpoint
SELECT enable_tenant_rls('document_ack');
--> statement-breakpoint
-- Registros ♻: no se borran físicamente.
REVOKE DELETE ON document, document_version, document_ack FROM app_tenant;
--> statement-breakpoint
-- Una versión aprobada es inmutable: solo puede pasar a "obsolete" (sin tocar contenido ni firma).
CREATE OR REPLACE FUNCTION document_version_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'approved' THEN
    IF NEW.status NOT IN ('approved', 'obsolete')
       OR NEW.body IS DISTINCT FROM OLD.body
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.document_id IS DISTINCT FROM OLD.document_id
       OR NEW.signature IS DISTINCT FROM OLD.signature
       OR NEW.evidence_hash IS DISTINCT FROM OLD.evidence_hash
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
      RAISE EXCEPTION 'Una versión aprobada del documento es inmutable' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
  ELSIF OLD.status = 'obsolete' THEN
    RAISE EXCEPTION 'Una versión obsoleta del documento es inmutable' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER document_version_guard_trg BEFORE UPDATE ON document_version FOR EACH ROW EXECUTE FUNCTION document_version_guard();
