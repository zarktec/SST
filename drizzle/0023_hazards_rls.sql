SELECT enable_tenant_rls('hazard_matrix');
--> statement-breakpoint
SELECT enable_tenant_rls('hazard_row');
--> statement-breakpoint
-- Las versiones de la matriz se conservan (registro ♻); las filas de un borrador sí se pueden quitar.
REVOKE DELETE ON hazard_matrix FROM app_tenant;
--> statement-breakpoint
-- Una versión aprobada es inmutable: sin cambios ni borrado de sus filas, ni cambios en su cabecera salvo pasar a "superseded".
CREATE OR REPLACE FUNCTION hazard_row_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE st text; mid uuid;
BEGIN
  mid := COALESCE(NEW.matrix_id, OLD.matrix_id);
  SELECT status INTO st FROM hazard_matrix WHERE id = mid;
  IF st IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'La versión aprobada de la matriz de peligros es inmutable' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
--> statement-breakpoint
CREATE TRIGGER hazard_row_guard_trg BEFORE UPDATE OR DELETE ON hazard_row FOR EACH ROW EXECUTE FUNCTION hazard_row_guard();
